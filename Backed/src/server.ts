import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import redis from '@fastify/redis';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dotenv from 'dotenv';
import { FastifyRequest, FastifyReply } from 'fastify';

import authRoutes from './modules/auth/routes.js';
import productRoutes from './modules/product/routes.js';
import inventoryRoutes from './modules/inventory/routes.js';
import orderRoutes from './modules/order/routes.js';
import checkoutRoutes from './modules/checkout/routes.js';
import {User} from './types/index.js'
import rateLimit from '@fastify/rate-limit';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
});  

await fastify.register(redis, {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'development-secret',
});

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'FlashCommerce API',
      description: 'High-Traffic Flash Sale System API',
      version: '1.0.0',
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 3000}` },
    ],
  },
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
});

await fastify.register(rateLimit,{
  max:100,
  timeWindow:'1 minute'
})

// Add authenticate decorator for user
fastify.decorate('authenticate', async function(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Add authenticate decorator for admin
fastify.decorate('authenticateAdmin', async function(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as User;
    if (user.role!== 'admin') {
      return reply.code(403).send({ error: 'only Admin allowed' });
    }
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(productRoutes, { prefix: '/api/products' });
await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
await fastify.register(orderRoutes, { prefix: '/api/orders' });
await fastify.register(checkoutRoutes, { prefix: '/api/checkout' });

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 FlashCommerce Server running at http://localhost:${port}`);
    console.log(`📚 API Documentation at http://localhost:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
