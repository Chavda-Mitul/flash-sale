import { FastifyPluginAsync } from 'fastify';
import { createUser, findUserByEmail, verifyPassword, findUserById } from './service.js';
import type { CreateUserInput, LoginInput } from '../../types/index.js';

const routes: FastifyPluginAsync = async (fastify: any) => {
  // Register
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6, },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
  }, 

  async (request: any, reply: any) => {
    const { email, password, firstName, lastName } = request.body;

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const user = await createUser({ email, password, firstName, lastName });

    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      },
    };
  });

  // Login

  const loginSchema = {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }

  const loginService = async (request: any, reply: any) =>
  {
    const { email, password } = request.body;

    const user = await findUserByEmail(email);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return reply.code(403).send({ error: 'Account is suspended' });
    }

    const isValid = await verifyPassword(user, password);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      },
    };
  }

  fastify.post('/login',loginSchema , loginService);


  // Get current user

  const meService = async (request: any, reply: any) => {
    const userId = request.user.userId;
    const user = await findUserById(userId);

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    };
  }

  const headerAuth = {
    preHandler: [fastify.authenticate],
  }
  fastify.get('/me', headerAuth ,meService);

  // Refresh token

  const refereshService = async (request: any, reply: any) => { 
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    try {
      const decoded: any = fastify.jwt.verify(authHeader.slice(7));
      const token = fastify.jwt.sign({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      return { success: true, data: { token } };
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  }
  fastify.post('/refresh', refereshService);
};

export default routes;
