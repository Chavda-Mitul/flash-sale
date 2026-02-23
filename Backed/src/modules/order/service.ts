import db from '../../db/connection.js';
import { generateOrderNumber } from '../auth/service.js';
import type { Order, OrderItem, CreateOrderInput, OrderStatus } from '../../types/index.js';

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const orderNumber = generateOrderNumber();
  
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, user_id, total_amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [orderNumber, input.userId, input.items.reduce((sum: number, item) => sum + item.unitPrice * item.quantity, 0)]
    );
    
    const order = orderResult.rows[0];

    // Create order items
    for (const item of input.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.variantId, item.quantity, item.unitPrice]
      );
    }

    await client.query('COMMIT');

    return mapOrder(order);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrderById(id: string): Promise<Order | null> {
  const result = await db.query(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );
  
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const result = await db.query(
    'SELECT * FROM orders WHERE order_number = $1',
    [orderNumber]
  );
  
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  const result = await db.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows.map(mapOrder);
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const result = await db.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [orderId]
  );
  
  return result.rows;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  const updates: string[] = ['status = $1'];
  const values: any[] = [status];
  
  if (status === 'confirmed') {
    updates.push('confirmed_at = CURRENT_TIMESTAMP');
  }
  
  values.push(id);
  
  const result = await db.query(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function updateStripePaymentId(id: string, stripePaymentId: string): Promise<Order | null> {
  const result = await db.query(
    'UPDATE orders SET stripe_payment_id = $1 WHERE id = $2 RETURNING *',
    [stripePaymentId, id]
  );
  
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    status: row.status,
    totalAmount: parseFloat(row.total_amount),
    stripePaymentId: row.stripe_payment_id,
    createdAt: new Date(row.created_at),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
  };
}
