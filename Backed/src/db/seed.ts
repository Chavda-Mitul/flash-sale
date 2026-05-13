import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query, getClient } from './connection.js';

dotenv.config();

const SALT_ROUNDS = 10;

async function seed() {
  console.log('Seeding database...');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Clear existing data in dependency order
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM inventory');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM users');

    // Users
    const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
    const customerHash = await bcrypt.hash('customer123', SALT_ROUNDS);

    const adminResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, 'Admin', 'User', 'admin', 'active') RETURNING id`,
      ['admin@flashcommerce.com', adminHash]
    );

    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, 'Alice', 'Smith', 'customer', 'active')`,
      ['alice@example.com', customerHash]
    );

    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, 'Bob', 'Jones', 'customer', 'active')`,
      ['bob@example.com', customerHash]
    );

    console.log('  Users seeded');

    // Products + inventory
    const products = [
      {
        name: 'Wireless Noise-Cancelling Headphones',
        description: 'Premium over-ear headphones with 30-hour battery life.',
        sku: 'HEADPHONES-001',
        basePrice: 299.99,
        salePrice: 149.99,
        quantity: 50,
      },
      {
        name: 'Mechanical Keyboard',
        description: 'Compact TKL layout with Cherry MX Red switches.',
        sku: 'KEYBOARD-001',
        basePrice: 159.99,
        salePrice: 89.99,
        quantity: 30,
      },
      {
        name: '4K Webcam',
        description: '4K UHD webcam with built-in ring light.',
        sku: 'WEBCAM-4K-001',
        basePrice: 199.99,
        salePrice: 99.99,
        quantity: 20,
      },
      {
        name: 'USB-C Hub (7-in-1)',
        description: 'HDMI, USB-A x3, SD card, USB-C PD 100W.',
        sku: 'USBHUB-7IN1-001',
        basePrice: 79.99,
        salePrice: null,
        quantity: 100,
      },
    ];

    for (const p of products) {
      const productResult = await client.query(
        `INSERT INTO products (name, description, sku, base_price, sale_price, status)
         VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
        [p.name, p.description, p.sku, p.basePrice, p.salePrice]
      );

      await client.query(
        `INSERT INTO inventory (product_id, variant_id, quantity, reserved)
         VALUES ($1, 'default', $2, 0)`,
        [productResult.rows[0].id, p.quantity]
      );
    }

    console.log('  Products + inventory seeded');

    await client.query('COMMIT');
    console.log('Seeding complete.');
    console.log('');
    console.log('  admin@flashcommerce.com  / admin123');
    console.log('  alice@example.com        / customer123');
    console.log('  bob@example.com          / customer123');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
