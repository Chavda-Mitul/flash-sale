import { buildApp, getAdminToken, getCustomerToken } from './setup.js';

describe('Inventory routes', () => {
  let adminToken: string;
  let customerToken: string;
  let productId: string;

  beforeAll(async () => {
    await buildApp();
    adminToken = await getAdminToken();
    customerToken = await getCustomerToken();

    // Create a fresh product to use for inventory tests
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/products/',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Inv Test Product', sku: `INV-${Date.now()}`, basePrice: 50 },
    });
    productId = JSON.parse(res.body).data.id;
  });

  describe('GET /api/inventory/all', () => {
    it('is publicly accessible', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/inventory/all' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });

  describe('GET /api/inventory/:productId', () => {
    it('returns inventory for a product', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: `/api/inventory/${productId}` });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PUT /api/inventory/:productId', () => {
    it('admin can set inventory quantity', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PUT',
        url: `/api/inventory/${productId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: 50 },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.quantity).toBe(50);
    });

    it('unauthenticated gets 401', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PUT',
        url: `/api/inventory/${productId}`,
        payload: { quantity: 9999 },
      });
      expect(res.statusCode).toBe(401);
    });

    it('customer gets 403', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PUT',
        url: `/api/inventory/${productId}`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { quantity: 9999 },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/inventory/:productId/:variantId', () => {
    it('admin can update quantity', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/inventory/${productId}/default`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: 75 },
      });
      expect(res.statusCode).toBe(200);
    });

    it('unauthenticated gets 401', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/inventory/${productId}/default`,
        payload: { quantity: 9999 },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
