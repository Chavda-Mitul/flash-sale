import app from '../app.js';

export async function buildApp() {
  await app.ready();
  return app;
}

export async function getAdminToken(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@flashcommerce.com', password: 'admin123' },
  });
  return JSON.parse(res.body).data.token;
}

export async function getCustomerToken(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'alice@example.com', password: 'customer123' },
  });
  return JSON.parse(res.body).data.token;
}

export async function getCustomer2Token(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'bob@example.com', password: 'customer123' },
  });
  return JSON.parse(res.body).data.token;
}

afterAll(async () => {
  await app.close();
});
