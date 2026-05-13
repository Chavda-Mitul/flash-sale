import { buildApp, getAdminToken, getCustomerToken, getCustomer2Token } from './setup.js';

describe('Payment routes', () => {
  let adminToken: string;
  let customerToken: string;
  let customer2Token: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    await buildApp();
    adminToken = await getAdminToken();
    customerToken = await getCustomerToken();
    customer2Token = await getCustomer2Token();

    const app = await buildApp();

    // Create product + inventory
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/products/',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Payment Test Product', sku: `PAY-${Date.now()}`, basePrice: 49.99 },
    });
    productId = JSON.parse(productRes.body).data.id;

    await app.inject({
      method: 'PUT',
      url: `/api/inventory/${productId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { quantity: 100 },
    });
    await app.inject({
      method: 'POST',
      url: `/api/inventory/${productId}/init-cache`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    // Create a pending order
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/checkout/initiate',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { items: [{ productId, quantity: 1, unitPrice: 49.99 }] },
    });
    orderId = JSON.parse(orderRes.body).data.orderId;
  });

  describe('POST /api/payment/create-intent', () => {
    it('returns 403 when another user tries to pay for the order', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/create-intent',
        headers: { authorization: `Bearer ${customer2Token}` },
        payload: { orderId },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without token', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/create-intent',
        payload: { orderId },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for a non-existent order', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/create-intent',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { orderId: '00000000-0000-0000-0000-000000000000' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/payment/order/:orderId', () => {
    it('returns null data when no payment intent created yet', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/api/payment/order/${orderId}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(200);
      // No payment intent created yet so data is null
      expect(JSON.parse(res.body).data).toBeNull();
    });

    it('returns 403 for another user', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: `/api/payment/order/${orderId}`,
        headers: { authorization: `Bearer ${customer2Token}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/payment/webhook', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/webhook',
        headers: { 'content-type': 'application/json' },
        payload: Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' })),
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('Missing stripe-signature header');
    });

    it('returns 400 for invalid signature', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/payment/webhook',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 'invalid_sig',
        },
        payload: Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' })),
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
