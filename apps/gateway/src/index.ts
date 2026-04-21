import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './routes/auth.js';
import { uploadRoutes } from './routes/upload.js';
import { jobsRoutes } from './routes/jobs.js';
import { exportRoutes } from './routes/export.js';
import { reviewRoutes } from './routes/review.js';
import { registerRateLimit } from './middleware/rateLimit.js';

const start = async () => {
  const fastify = Fastify({ logger: true });

  // ── Swagger (must register before routes) ────────────────────────────────
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'DocuExtract — Gateway API',
        version: '0.1.0',
        description:
          'REST API for the DocuExtract financial document processing system.\n\n' +
          '**Auth flow:** `POST /auth/login` → copy the token → click **Authorize 🔒** → paste as Bearer token.',
      },
      servers: [{ url: `http://localhost:${process.env.PORT ?? 3000}`, description: 'Local dev' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'Auth', description: 'Register and login to receive a JWT token' },
        { name: 'Upload', description: 'Upload PDF statements to trigger extraction' },
        { name: 'Jobs', description: 'Monitor job status and retrieve extracted rows' },
        { name: 'Review', description: 'Approve or correct rows that need manual review' },
        { name: 'Export', description: 'Download approved transactions as Excel' },
        { name: 'System', description: 'Health check' },
      ],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true, persistAuthorization: true },
    staticCSP: true,
  });

  // ── Shared schemas (referenced via $ref in route schemas) ─────────────────
  fastify.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    properties: { error: { type: 'string' } },
  });

  fastify.addSchema({
    $id: 'AuthResponse',
    type: 'object',
    properties: {
      token: { type: 'string', description: 'JWT — use as: Authorization: Bearer <token>' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'reviewer'] },
        },
      },
    },
  });

  fastify.addSchema({
    $id: 'Job',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      status: {
        type: 'string',
        enum: ['queued', 'extracting', 'enriching', 'pending_review', 'complete', 'failed'],
      },
      originalFilename: { type: 'string' },
      outletCode: { type: 'string', examples: ['F5063'] },
      totalRows: { type: 'integer' },
      approvedRows: { type: 'integer' },
      reviewRows: { type: 'integer' },
      errorMessage: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      completedAt: { type: ['string', 'null'] },
    },
  });

  fastify.addSchema({
    $id: 'Transaction',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      jobId: { type: 'string', format: 'uuid' },
      outletCode: { type: 'string' },
      pageNumber: { type: ['integer', 'null'] },
      date: { type: 'string' },
      documentDescription: { type: 'string' },
      invoiceNumber: { type: ['string', 'null'] },
      cnNumber: { type: ['string', 'null'] },
      debit: { type: ['string', 'null'] },
      credit: { type: ['string', 'null'] },
      documentCategory: { type: 'string', enum: ['SOA', 'INVOICE', 'CN', 'PAYMENT'] },
      documentType: { type: ['string', 'null'] },
      vendorNameRaw: { type: 'string' },
      vendorCode: { type: ['string', 'null'] },
      vendorNameMatched: { type: ['string', 'null'] },
      glCode: { type: ['string', 'null'] },
      glLabel: { type: ['string', 'null'] },
      glMatchMethod: { type: ['string', 'null'] },
      vendorMatchScore: { type: ['number', 'null'] },
      status: { type: 'string', enum: ['raw', 'approved', 'needs_review', 'reviewed'] },
      confidence: { type: ['number', 'null'] },
      extractionRemarks: { type: ['string', 'null'] },
      reviewReason: { type: ['string', 'null'] },
      reviewNotes: { type: ['string', 'null'] },
      reviewedAt: { type: ['string', 'null'] },
      // Joined from Job / Client — populated by rows endpoints
      companyName: { type: ['string', 'null'] },
      originalFilename: { type: ['string', 'null'] },
    },
  });

  // ── Core plugins ──────────────────────────────────────────────────────────
  await fastify.register(fastifyCors, { origin: process.env.CORS_ORIGIN || '*' });
  await fastify.register(fastifyMultipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[Gateway] FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
    process.exit(1);
  }
  await fastify.register(fastifyJwt, { secret: jwtSecret, sign: { expiresIn: '8h' } });

  await registerRateLimit(fastify);

  // ── Routes ────────────────────────────────────────────────────────────────
  await fastify.register(authRoutes);
  await fastify.register(uploadRoutes);
  await fastify.register(jobsRoutes);
  await fastify.register(reviewRoutes);
  await fastify.register(exportRoutes);

  fastify.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Gateway health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', examples: ['ok'] },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  try {
    const port = Number.parseInt(process.env.PORT ?? '3000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`[Gateway] Running on http://localhost:${port}`);
    console.log(`[Gateway] Swagger UI  → http://localhost:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();