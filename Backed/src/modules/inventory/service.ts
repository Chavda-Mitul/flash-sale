import db from '../../db/connection.js';
import type { Inventory } from '../../types/index.js';

const RESERVATION_TTL_SECONDS = 15 * 60; // 15 minutes

export interface CreateInventoryInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface InventoryWithAvailable extends Inventory {
  available: number;
}

export async function createInventory(input: CreateInventoryInput): Promise<Inventory> {
  const result = await db.query(
    `INSERT INTO inventory (product_id, variant_id, quantity, reserved)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (product_id, variant_id) 
     DO UPDATE SET quantity = inventory.quantity + $3
     RETURNING *`,
    [input.productId, input.variantId || 'default', input.quantity]
  );
  
  return mapInventory(result.rows[0]);
}

export async function getInventory(productId: string, variantId?: string): Promise<InventoryWithAvailable | null> {
  const result = await db.query(
    'SELECT * FROM inventory WHERE product_id = $1 AND variant_id = $2',
    [productId, variantId || 'default']
  );
  
  if (!result.rows[0]) return null;
  
  const inv = mapInventory(result.rows[0]);
  return {
    ...inv,
    available: inv.quantity - inv.reserved,
  };
}

export async function getInventoryForProduct(productId: string): Promise<InventoryWithAvailable[]> {
  const result = await db.query(
    'SELECT * FROM inventory WHERE product_id = $1',
    [productId]
  );
  
  return result.rows.map((row: any) => {
    const inv = mapInventory(row);
    return {
      ...inv,
      available: inv.quantity - inv.reserved,
    };
  });
}

export async function updateQuantity(id: string, quantity: number): Promise<Inventory | null> {
  const result = await db.query(
    'UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [quantity, id]
  );
  
  return result.rows[0] ? mapInventory(result.rows[0]) : null;
}

// Initialize Redis inventory from database
export async function initializeRedisInventory(redis: any, productId: string, variantId?: string): Promise<void> {
  const inventory = await getInventory(productId, variantId);
  if (inventory) {
    const key = `inventory:${productId}:${variantId || 'default'}`;
    await redis.set(key, inventory.quantity - inventory.reserved);
  }
}

// Lua script for atomic inventory decrement
export const DECREMENT_INVENTORY_SCRIPT = `
  local key = KEYS[1]
  local quantity = tonumber(ARGV[1])
  
  local current = redis.call('GET', key)
  if current == false then
    return -2  -- Inventory not found
  end
  
  local count = tonumber(current)
  if count < quantity then
    return -1  -- Insufficient inventory
  end
  
  local new_value = redis.call('DECRBY', key, quantity)
  return new_value  -- Returns new count
`;

export async function decrementInventory(
  redis: any,
  productId: string,
  variantId: string,
  quantity: number
): Promise<{ success: boolean; newCount?: number; error?: string }> {
  const key = `inventory:${productId}:${variantId}`;
  
  try {
    const result = await redis.eval(DECREMENT_INVENTORY_SCRIPT, 1, key, quantity);
    
    if (result === -1) {
      return { success: false, error: 'Insufficient inventory' };
    }
    if (result === -2) {
      return { success: false, error: 'Inventory not found' };
    }
    
    return { success: true, newCount: result };
  } catch (error) {
    return { success: false, error: 'Failed to decrement inventory' };
  }
}

export async function incrementInventory(
  redis: any,
  productId: string,
  variantId: string,
  quantity: number
): Promise<void> {
  const key = `inventory:${productId}:${variantId}`;
  await redis.incrby(key, quantity);
}

export async function createReservation(
  redis: any,
  orderId: string,
  productId: string,
  variantId: string,
  quantity: number
): Promise<void> {
  const key = `reservation:${orderId}`;
  const value = JSON.stringify({ productId, variantId, quantity });
  await redis.setex(key, RESERVATION_TTL_SECONDS, value);
}

export async function getReservation(redis: any, orderId: string): Promise<{ productId: string; variantId: string; quantity: number } | null> {
  const key = `reservation:${orderId}`;
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function deleteReservation(redis: any, orderId: string): Promise<void> {
  const key = `reservation:${orderId}`;
  await redis.del(key);
}

function mapInventory(row: any): Inventory {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    reserved: row.reserved,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
