import Stripe from 'stripe';
import db from '../../db/connection.js';
import type { Payment, PaymentStatus } from '../../types/index.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-04-22.dahlia',
});

export async function createPaymentIntent(
  orderId: string,
  amount: number
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe expects cents
    currency: 'usd',
    metadata: { orderId },
  });

  await db.query(
    `INSERT INTO payments (order_id, stripe_payment_intent_id, amount, status)
     VALUES ($1, $2, $3, 'pending')`,
    [orderId, paymentIntent.id, amount]
  );

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

export async function handleWebhookEvent(
  payload: Buffer,
  signature: string,
  redis: any
): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const orderId = intent.metadata?.orderId;

  if (!orderId) return;

  switch (event.type) {
    case 'payment_intent.succeeded': {
      await updatePaymentStatus(intent.id, 'succeeded');
      const { confirmCheckout } = await import('../checkout/service.js');
      await confirmCheckout(orderId, intent.id, redis);
      break;
    }
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      await updatePaymentStatus(intent.id, 'failed');
      const { cancelCheckout } = await import('../checkout/service.js');
      await cancelCheckout(orderId, redis);
      break;
    }
  }
}

export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const result = await db.query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId]
  );
  return result.rows[0] ? mapPayment(result.rows[0]) : null;
}

async function updatePaymentStatus(intentId: string, status: PaymentStatus): Promise<void> {
  await db.query(
    `UPDATE payments SET status = $1, processed_at = CURRENT_TIMESTAMP
     WHERE stripe_payment_intent_id = $2`,
    [status, intentId]
  );
}

function mapPayment(row: any): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    amount: parseFloat(row.amount),
    status: row.status as PaymentStatus,
    createdAt: new Date(row.created_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
  };
}
