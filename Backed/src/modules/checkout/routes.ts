import { FastifyPluginAsync } from 'fastify';
import { initiateCheckout, confirmCheckout, cancelCheckout } from './service.js';

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

  // Confirm checkout (after payment succeeds)
  fastify.post('/confirm', async (request: any, reply: any) => {
    const { orderId, stripePaymentId } = request.body;

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
