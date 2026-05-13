import { buildApp } from './setup.js';

describe('Auth routes', () => {
  beforeAll(() => buildApp());

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns a token', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `test_${Date.now()}@example.com`,
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(body.data.user.role).toBe('customer');
    });

    it('returns 409 for duplicate email', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'alice@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns token for valid credentials', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'alice@example.com', password: 'customer123' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.token).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'alice@example.com', password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nobody@example.com', password: 'password123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile with valid token', async () => {
      const app = await buildApp();
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'alice@example.com', password: 'customer123' },
      });
      const token = JSON.parse(loginRes.body).data.token;

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.email).toBe('alice@example.com');
    });

    it('returns 401 without token', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
      expect(res.statusCode).toBe(401);
    });
  });
});
