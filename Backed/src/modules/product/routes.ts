import { FastifyPluginAsync } from 'fastify';
import { createProduct, getProductById, getProducts, getFlashSaleProducts, updateProduct } from './service.js';
import type { CreateProductInput } from '../../types/index.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  // Get all products
  fastify.get('/', async (request: any, reply: any) => {
    const { limit, offset, status } = request.query;
    const products = await getProducts({ limit, offset, status });

    return {
      success: true,
      data: products,
    }
  });

  // Get flash sale products
  fastify.get('/flash-sale', async (request: any, reply: any) => {
    const products = await getFlashSaleProducts();

    return {
      success: true,
      data: products,
    };
  });

  // Get product by ID
  fastify.get('/:id', async (request: any, reply: any) => {
    const { id } = request.params;
    const product = await getProductById(id);

    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }

    return {
      success: true,
      data: product,
    };
  });

  // Create product (admin only in production)
  const adminHeader = [fastify.authenticate];

  const createProductSchema = {
      body: {
        type: 'object',
        required: ['name', 'sku', 'basePrice'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          sku: { type: 'string'},
          basePrice: { type: 'number', minimum: 0 },
          salePrice: { type: 'number', minimum: 0 },
          imageUrl: { type: 'string' },
        },
      },
    }

    const createProductService =  async (request: any, reply: any) => 
     {
      const product = await createProduct(request.body);
      if(!product)
      {
        return reply.code(409).send({ error: 'Product with same sku can not be created' });
      }

      return {
        success: true,
        data: product,
      };
     }

  fastify.post('/', {preHandler: adminHeader,schema:createProductSchema,},createProductService);

  // Update product
  const updateProductService = async (request: any, reply: any) => {
    const { id } = request.params;
    const product = await updateProduct(id, request.body);

    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }

    return {
      success: true,
      data: product,
    };
  }

  fastify.patch('/:id', { preHandler: adminHeader}, updateProductService);
};

export default routes;
