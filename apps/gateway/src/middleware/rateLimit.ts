import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

export async function registerRateLimit(fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 100,           // max 100 requests per window
    timeWindow: '1 minute',
    // More strict limit on auth routes to prevent brute-force
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
    }),
  });

  // Stricter limit on auth endpoints (10 per minute)
  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url?.startsWith('/auth/')) {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      };
    }
  });
}
