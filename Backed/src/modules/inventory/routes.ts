import { FastifyPluginAsync } from 'fastify';
import { getInventory, getInventoryForProduct, initializeRedisInventory } from './service.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  const redis = fastify.redis;

  // Get inventory for a product variant
  fastify.get('/:productId', async (request: any, reply: any) => {
    const { productId } = request.params;
    const { variantId } = request.query;

    const inventory = await getInventory(productId, variantId);

    if (!inventory) {
      return reply.code(404).send({ error: 'Inventory not found' });
    }

    return {
      success: true,
      data: {
        productId: inventory.productId,
        variantId: inventory.variantId,
        quantity: inventory.quantity,
        reserved: inventory.reserved,
        available: inventory.available,
      },
    };
  });

  // Get all inventory for a product
  fastify.get('/:productId/all', async (request: any, reply: any) => {
    const { productId } = request.params;

    const inventory = await getInventoryForProduct(productId);

    return {
      success: true,
      data: inventory.map((inv: any) => ({
        productId: inv.productId,
        variantId: inv.variantId,
        quantity: inv.quantity,
        reserved: inv.reserved,
        available: inv.available,
      })),
    };
  });

  // Initialize Redis cache for inventory (admin)
  fastify.post('/:productId/init-cache', {
    preHandler: [fastify.authenticate],
  }, async (request: any, reply: any) => {
    const { productId } = request.params;
    const { variantId } = request.query;

    await initializeRedisInventory(redis, productId, variantId);

    return {
      success: true,
      message: 'Redis cache initialized',
    };
  });
};

export default routes;
