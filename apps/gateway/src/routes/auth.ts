import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@docuextract/db';

export async function authRoutes(fastify: FastifyInstance) {
  // Register a new user (admin or reviewer)
  fastify.post('/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', examples: ['admin@mct.com'] },
          password: { type: 'string', minLength: 6, examples: ['secret123'] },
          role: { type: 'string', enum: ['admin', 'reviewer'], default: 'reviewer' },
        },
      },
      response: {
        200: { $ref: 'AuthResponse#' },
        400: { $ref: 'ErrorResponse#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { email, password, role } = request.body as {
      email: string;
      password: string;
      role?: 'admin' | 'reviewer';
    };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        role: role || 'reviewer',
      },
    });

    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });

  // Login
  fastify.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login — returns a JWT token',
      description: 'Copy the returned `token` and click **Authorize 🔒** in Swagger UI to authenticate all subsequent requests.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', examples: ['admin@mct.com'] },
          password: { type: 'string', examples: ['secret123'] },
        },
      },
      response: {
        200: { $ref: 'AuthResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });
}