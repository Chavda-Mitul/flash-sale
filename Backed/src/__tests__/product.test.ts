import { buildApp, getAdminToken, getCustomerToken } from './setup.js';

const testSku = () => `TEST-SKU-${Date.now()}`;

describe('Product routes', () => {
  let adminToken: string;
  let customerToken: string;
  let createdProductId: string;

  beforeAll(async () => {
    await buildApp();
    adminToken = await getAdminToken();
    customerToken = await getCustomerToken();
  });

  describe('GET /api/products/', () => {
    it('returns product list publicly', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/products/' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });

  describe('GET /api/products/flash-sale', () => {
    it('returns only products with a sale price', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/products/flash-sale' });
      expect(res.statusCode).toBe(200);
      const products = JSON.parse(res.body).data;
      products.forEach((p: any) => expect(p.salePrice).toBeDefined());
    });
  });

  describe('POST /api/products/', () => {
    it('admin can create a product', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Test Product', sku: testSku(), basePrice: 99.99, salePrice: 49.99 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      createdProductId = body.data.id;
    });

    it('customer gets 403', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/products/',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { name: 'Hack', sku: testSku(), basePrice: 1 },
      });
      expect(res.statusCode).toBe(403);
    });

    it('unauthenticated gets 401', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/products/',
        payload: { name: 'Hack', sku: testSku(), basePrice: 1 },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/products/:id', () => {
    it('admin can update a product', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/products/${createdProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { salePrice: 39.99 },
      });
      expect(res.statusCode).toBe(200);
    });

    it('customer gets 403', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/products/${createdProductId}`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { salePrice: 1 },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('customer gets 403', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/products/${createdProductId}`,
        headers: { authorization: `Bearer ${customerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('admin can delete a product', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/products/${createdProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
