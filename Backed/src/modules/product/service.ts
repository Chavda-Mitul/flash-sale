import db from '../../db/connection.js';
import type { Product, CreateProductInput } from '../../types/index.js';

export async function createProduct(input: CreateProductInput): Promise<Product | null> {

  const product = await getProductBySku(input.sku);
  
  if(product)
  {
    return null;
  }

  const result = await db.query(
    `INSERT INTO products (name, description, sku, base_price, sale_price, image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [input.name, input.description, input.sku, input.basePrice, input.salePrice, input.imageUrl, 'active']
  );

  const newProduct = mapProduct(result.rows[0]);

  // Create inventory record with quantity 0
  await db.query(
    `INSERT INTO inventory (product_id, quantity, reserved)
     VALUES ($1, $2, $3)`,
    [newProduct.id, 0, 0]
  );

  return newProduct;
}

export async function getProductById(id: string): Promise<Product | null> {
  const result = await db.query(
    'SELECT * FROM products WHERE id = $1',
    [id]
  );
  
  return result.rows[0] ? mapProduct(result.rows[0]) : null;
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  const result = await db.query(
    'SELECT * FROM products WHERE sku = $1',
    [sku]
  );
  
  return result.rows[0] ? mapProduct(result.rows[0]) : null;
}

export async function getProducts(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const { status = 'active', limit = 20, offset = 0 } = options || {};
  
  const result = await db.query(
    `SELECT * FROM products 
     WHERE status = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );
  
  return result.rows.map(mapProduct);
}

export async function getFlashSaleProducts(): Promise<Product[]> {
  const result = await db.query(
    `SELECT * FROM products 
     WHERE status = 'active' AND sale_price IS NOT NULL 
     ORDER BY created_at DESC`,
    []
  );

  return result.rows.map(mapProduct);
}

export async function deleteProduct(id:Product['id']): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM products 
     WHERE id = $1`,
    [id]
  );
  return Boolean(result.rowCount);
}

export async function updateProduct(
  id: string,
  input: Partial<CreateProductInput>
): Promise<Product | null> {

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const key in input) {
    const value = input[key as keyof CreateProductInput];

    if (value === undefined) continue;

    const column = columnMap[key as keyof typeof columnMap];
    if (!column) continue;

    fields.push(`${column} = $${paramIndex++}`);
    values.push(value);
  }

  if (fields.length === 0) {
    return getProductById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await db.query(
    `UPDATE products
     SET ${fields.join(", ")}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] ? mapProduct(result.rows[0]) : null;
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    basePrice: parseFloat(row.base_price),
    salePrice: row.sale_price ? parseFloat(row.sale_price) : undefined,
    imageUrl: row.image_url,
    status: row.status,
    quantity:row.quantity,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Maps TypeScript property names to database column names
const columnMap = {
  name: 'name',
  description: 'description',
  sku: 'sku',
  basePrice: 'base_price',
  salePrice: 'sale_price',
  imageUrl: 'image_url',
};
