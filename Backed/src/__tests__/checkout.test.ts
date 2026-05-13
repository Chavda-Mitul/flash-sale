import { buildApp, getAdminToken, getCustomerToken, getCustomer2Token } from './setup.js';

describe('Checkout routes', () => {
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

    // Create product
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/products/',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Checkout Test Product', sku: `CO-${Date.now()}`, basePrice: 29.99, salePrice: 19.99 },
    });
    productId = JSON.parse(productRes.body).data.id;

    // Set inventory in DB
    await app.inject({
      method: 'PUT',
      url: `/api/inventory/${productId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { quantity: 100 },
    });

    // Seed Redis cache
    await app.inject({
      method: 'POST',
      url: `/api/inventory/${productId}/init-cache`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
  });

  describe('POST /api/checkout/initiate', () => {
    it('reserves inventory and creates a pending order', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkout/initiate',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: {
          items: [{ productId, quantity: 1, unitPrice: 19.99 }],
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.orderId).toBeDefined();
      orderId = body.data.orderId;
    });

    it('returns 401 without token', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkout/initiate',
        payload: { items: [{ productId, quantity: 1, unitPrice: 19.99 }] },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/checkout/cancel/:orderId', () => {
    it('returns 403 when another user tries to cancel', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/api/checkout/cancel/${orderId}`,
        headers: { authorization: `Bearer ${customer2Token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('owner can cancel their own order', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: `/api/checkout/cancel/${orderId}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/checkout/confirm', () => {
    let confirmOrderId: string;

    beforeAll(async () => {
      // Create a fresh order to confirm
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkout/initiate',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { items: [{ productId, quantity: 1, unitPrice: 19.99 }] },
      });
      confirmOrderId = JSON.parse(res.body).data.orderId;
    });

    it('returns 403 when another user tries to confirm', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkout/confirm',
        headers: { authorization: `Bearer ${customer2Token}` },
        payload: { orderId: confirmOrderId, stripePaymentId: 'pi_test_fake' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('owner can confirm their own order', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkout/confirm',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { orderId: confirmOrderId, stripePaymentId: 'pi_test_fake' },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
