import { FastifyPluginAsync } from 'fastify';
import { createPaymentIntent, getPaymentByOrderId, handleWebhookEvent } from './service.js';
import { getOrderById } from '../order/service.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  // Webhook must parse raw body for Stripe signature verification.
  // Register it in a scoped child plugin so the raw body parser does not
  // affect any other routes.
  fastify.register(async (webhookPlugin: any) => {
    webhookPlugin.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req: any, body: any, done: any) => done(null, body)
    );

    webhookPlugin.post('/webhook', async (request: any, reply: any) => {
      const signature = request.headers['stripe-signature'];
      if (!signature) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      try {
        await handleWebhookEvent(request.body as Buffer, signature, fastify.redis);
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }

      return { received: true };
    });
  });

  // Create a Stripe PaymentIntent for a pending order
  fastify.post('/create-intent', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request: any, reply: any) => {
    const { orderId } = request.body;
    const userId = request.user.userId;

    const order = await getOrderById(orderId);

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    if (order.userId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    if (order.status !== 'pending') {
      return reply.code(400).send({ error: `Order is not payable (status: ${order.status})` });
    }

    const result = await createPaymentIntent(orderId, order.totalAmount);

    return {
      success: true,
      data: {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        amount: order.totalAmount,
      },
    };
  });

  // Get payment status for an order
  fastify.get('/order/:orderId', {
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

    const payment = await getPaymentByOrderId(orderId);

    return {
      success: true,
      data: payment,
    };
  });
};

export default routes;
