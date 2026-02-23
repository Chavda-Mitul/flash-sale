import db from '../../db/connection.js';
import { createOrder } from '../order/service.js';
import { decrementInventory, incrementInventory, createReservation, deleteReservation, getReservation } from '../inventory/service.js';
import type { CreateOrderInput } from '../../types/index.js';

export interface CheckoutItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export async function initiateCheckout(
  userId: string,
  items: CheckoutItem[],
  redis: any
): Promise<CheckoutResult> {
  // Validate and decrement inventory atomically
  const inventoryResults = [];
  
  for (const item of items) {
    const variantId = item.variantId || 'default';
    const result = await decrementInventory(redis, item.productId, variantId, item.quantity);
    
    if (!result.success) {
      // Rollback: increment back any decremented inventory
      for (const prev of inventoryResults) {
        await incrementInventory(redis, prev.productId, prev.variantId, prev.quantity);
      }
      return { success: false, error: result.error || 'Failed to reserve inventory' };
    }
    
    inventoryResults.push({
      productId: item.productId,
      variantId,
      quantity: item.quantity,
    });
  }

  // Create order in database
  const orderInput: CreateOrderInput = {
    userId,
    items: items.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };

  try {
    const order = await createOrder(orderInput);

    // Create reservation in Redis with TTL
    for (const item of inventoryResults) {
      await createReservation(redis, order.id, item.productId, item.variantId, item.quantity);
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    // Rollback inventory
    for (const item of inventoryResults) {
      await incrementInventory(redis, item.productId, item.variantId, item.quantity);
    }
    throw error;
  }
}

export async function confirmCheckout(
  orderId: string,
  stripePaymentId: string,
  redis: any
): Promise<{ success: boolean; error?: string }> {
  const reservation = await getReservation(redis, orderId);
  
  if (reservation) {
    // Delete the reservation (inventory already decremented)
    await deleteReservation(redis, orderId);
  }

  // Update order with payment ID and status
  const { updateOrderStatus, updateStripePaymentId } = await import('../order/service.js');
  
  await updateStripePaymentId(orderId, stripePaymentId);
  await updateOrderStatus(orderId, 'confirmed');

  return { success: true };
}

export async function cancelCheckout(
  orderId: string,
  redis: any
): Promise<{ success: boolean; error?: string }> {
  const reservation = await getReservation(redis, orderId);
  
  if (reservation) {
    // Return inventory to pool
    await incrementInventory(redis, reservation.productId, reservation.variantId, reservation.quantity);
    await deleteReservation(redis, orderId);
  }

  // Update order status
  const { updateOrderStatus } = await import('../order/service.js');
  await updateOrderStatus(orderId, 'cancelled');

  return { success: true };
}

export async function cleanupExpiredReservations(redis: any): Promise<number> {
  // This would typically use Redis keyspace notifications or a cron job
  // For now, this is a placeholder for the cleanup logic
  return 0;
}
