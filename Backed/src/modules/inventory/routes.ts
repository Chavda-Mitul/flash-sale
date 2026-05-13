import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { createInventory, getAllProductInventory, getInventory, getInventoryForProduct, initializeRedisInventory, updateQuantity } from './service.js';
import { InventoryWithAvailable } from './service.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  const redis = fastify.redis;


  // get whole inventory 
  fastify.get('/all', async(request:FastifyRequest, reply:FastifyReply) => {
    const inventorys = await getAllProductInventory();

    return {
      success: true,
      data: inventorys.map((inv:any)=>( {
        productId: inv.productId,
        variantId: inv.variantId,
        quantity: inv.quantity,
        reserved: inv.reserved,
        available: inv.available
      }))
    }
  });

  // Get all inventory for a product (must be BEFORE /:productId to avoid matching "all" as productId)
  fastify.get('/:productId', async (request: any, reply: any) => {
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

  // Get inventory for a product variant
  fastify.get('/:productId/:variantId', async (request: any, reply: any) => {
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

  // To add inventory of the existing invnetory
fastify.patch('/:productId/:variantId', {
  preHandler: [fastify.authenticateAdmin],
}, async(request:any,reply:any)=>{
  const { productId,variantId } = request.params;

  const { quantity } = request.body;

  if (quantity === undefined) {
    return reply.code(400).send({ error: 'Quantity is required' });
  }

  const inventory = await getInventory(productId, variantId);

  if (!inventory) {
    return reply.code(404).send({ error: 'Product not found in Inventory' });
  }

  const updatedInventory = await updateQuantity(inventory.id, quantity);

  return {
    success: true,
    data:{
     id: updatedInventory?.id,
    available: updatedInventory?.quantity,
    productId: updatedInventory?.productId,
    variantId: updatedInventory?.variantId
    } as InventoryWithAvailable,
    message: 'Inventory updated successfully'
  };
});


// To create Inventory
fastify.put('/:productId', {
  preHandler: [fastify.authenticateAdmin],
}, async (request: any, reply: any) => {
  const { productId } = request.params;
  const { variantId, quantity } = request.body;

  const inventory = await createInventory({ productId, variantId, quantity: quantity ?? 0 });

  return {
    success: true,
    data: {
      id: inventory.id,
      productId: inventory.productId,
      variantId: inventory.variantId,
      quantity: inventory.quantity,
      reserved: inventory.reserved,
    },
  };
})




  // Initialize Redis cache for inventory (admin)
  fastify.post('/:productId/init-cache', {
    preHandler: [fastify.authenticateAdmin],
  }, async (request: any, reply: any) => {
    const { productId } = request.params;
    const { variantId } = request.query;

    await initializeRedisInventory(redis, productId, variantId);

    return {
      success: true,
      message: 'Redis cache initialized',
    };
  });

  // update the quantity and variant of the product 
};

export default routes;


// todo 
//  
// create a api to add the peoduct to invneotry with the set quantity 0
