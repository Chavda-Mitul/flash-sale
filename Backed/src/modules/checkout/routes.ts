import { FastifyPluginAsync } from 'fastify';
import { initiateCheckout, confirmCheckout, cancelCheckout } from './service.js';
import { getOrderById } from '../order/service.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  const redis = fastify.redis;

  // Initiate checkout (reserve inventory, create pending order)
  fastify.post('/initiate', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity', 'unitPrice'],
              properties: {
                productId: { type: 'string', format: 'uuid' },
                variantId: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number', minimum: 0 },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    const userId = request.user.userId;
    const { items } = request.body;

    const result = await initiateCheckout(userId, items, redis);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    return {
      success: true,
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      },
    };
  });

  // Confirm checkout (manual fallback — primary path is the Stripe webhook)
  fastify.post('/confirm', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['orderId', 'stripePaymentId'],
        properties: {
          orderId: { type: 'string', format: 'uuid' },
          stripePaymentId: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply: any) => {
    const { orderId, stripePaymentId } = request.body;
    const userId = request.user.userId;

    const order = await getOrderById(orderId);
    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }
    if (order.userId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const result = await confirmCheckout(orderId, stripePaymentId, redis);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    return {
      success: true,
      message: 'Order confirmed',
    };
  });

  // Cancel checkout (release inventory)
  fastify.post('/cancel/:orderId', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply: any) => {
    const { orderId } = request.params;
    const userId = request.user.userId;

    const order = await getOrderById(orderId);
    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }
    if (order.userId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const result = await cancelCheckout(orderId, redis);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    return {
      success: true,
      message: 'Checkout cancelled',
    };
  });
};

export default routes;
