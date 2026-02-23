import { FastifyPluginAsync } from 'fastify';
import { getOrderById, getOrdersByUser, getOrderItems, getOrderByNumber } from './service.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  // Get user's orders
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.user.userId;
    const orders = await getOrdersByUser(userId);

    return {
      success: true,
      data: orders,
    };
  });

  // Get order by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.user.userId;
    const { id } = request.params;

    const order = await getOrderById(id);

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    if (order.userId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const items = await getOrderItems(order.id);

    return {
      success: true,
      data: {
        ...order,
        items,
      },
    };
  });

  // Get order by order number (public for guest checkout)
  fastify.get('/number/:orderNumber', async (request: any, reply: any) => {
    const { orderNumber } = request.params;
    const order = await getOrderByNumber(orderNumber);

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    const items = await getOrderItems(order.id);

    return {
      success: true,
      data: {
        ...order,
        items,
      },
    };
  });
};

export default routes;
