import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// ─── Enrichment Service Docs Server ──────────────────────────────────────────
// Runs alongside the BullMQ worker on DOCS_PORT (default 3002).
// Exposes Swagger UI at http://localhost:3002/docs documenting the queue
// contract, enrichment pipeline stages, and vendor matching strategy.

export async function startEnrichmentDocsServer(): Promise<void> {
  const port = Number.parseInt(process.env.DOCS_PORT ?? '3002', 10);
  const fastify = Fastify({ logger: false });

  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'DocuExtract — Enrichment Service',
        version: '0.1.0',
        description:
          'Internal BullMQ worker that enriches raw transaction rows with vendor codes and GL account codes.\n\n' +
          '**This service has no public HTTP API.** It consumes jobs from `enrichment-queue` ' +
          'and writes enriched data back to the `Transaction` table.\n\n' +
          '**Pipeline:** Vendor fuzzy match (Fuse.js) → GL code assignment → row routing (approved / needs_review).',
      },
      servers: [{ url: `http://localhost:${process.env.DOCS_PORT ?? '3002'}`, description: 'Enrichment service docs' }],
      tags: [
        { name: 'Health', description: 'Service health and live configuration' },
        { name: 'Queue Contract', description: 'BullMQ job input/output schemas' },
        { name: 'Pipeline', description: 'Enrichment pipeline stage reference' },
        { name: 'Routing Rules', description: 'How rows are classified as approved or needs_review' },
      ],
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    staticCSP: true,
  });

  // ── Health ────────────────────────────────────────────────────────────────

  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Worker health check',
      response: {
        200: {
          type: 'object',
          properties: {
            service: { type: 'string', examples: ['enrichment'] },
            status: { type: 'string', examples: ['ok'] },
            queue: { type: 'string', examples: ['enrichment-queue'] },
            concurrency: { type: 'integer', examples: [2] },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => ({
    service: 'enrichment',
    status: 'ok',
    queue: 'enrichment-queue',
    concurrency: 2,
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/config', {
    schema: {
      tags: ['Health'],
      summary: 'Active configuration (secrets redacted)',
      response: {
        200: {
          type: 'object',
          properties: {
            REDIS_URL: { type: 'string', description: 'Redacted' },
            DATABASE_URL: { type: 'string', description: 'Redacted' },
          },
        },
      },
    },
  }, async () => ({
    REDIS_URL: process.env.REDIS_URL ? '***set***' : '***NOT SET***',
    DATABASE_URL: process.env.DATABASE_URL ? '***set***' : '***NOT SET***',
  }));

  // ── Queue Contract ────────────────────────────────────────────────────────

  fastify.get('/queue/input', {
    schema: {
      tags: ['Queue Contract'],
      summary: 'EnrichmentJobData — what extraction pushes to enrichment-queue',
      description:
        'The extraction worker enqueues this automatically after saving rows. ' +
        'You do not push to this queue directly during normal use.',
      response: {
        200: {
          type: 'object',
          required: ['jobId', 'clientId'],
          properties: {
            jobId: {
              type: 'string', format: 'uuid',
              description: 'UUID of the Job record — used to fetch raw transactions',
              examples: ['3018dd4e-7cf3-44c4-958a-36ea8c79892e'],
            },
            clientId: {
              type: 'string',
              description: 'Client ID — used to load the correct vendor master and chart of accounts',
              examples: ['mct-vision-client-id'],
            },
          },
        },
      },
    },
  }, async () => ({
    jobId: '3018dd4e-7cf3-44c4-958a-36ea8c79892e',
    clientId: 'mct-vision-client-id',
  }));

  fastify.get('/queue/output', {
    schema: {
      tags: ['Queue Contract'],
      summary: 'Final job status after enrichment',
      description: 'Enrichment does not return a value — it writes directly to the DB and updates Job.status.',
      response: {
        200: {
          type: 'object',
          properties: {
            jobStatus: {
              type: 'string',
              enum: ['complete', 'pending_review'],
              description: '`complete` if all rows approved; `pending_review` if any row needs manual review',
            },
            approvedRows: { type: 'integer', description: 'Rows with status=approved' },
            reviewRows: { type: 'integer', description: 'Rows with status=needs_review' },
          },
        },
      },
    },
  }, async () => ({ jobStatus: 'complete', approvedRows: 6, reviewRows: 0 }));

  // ── Pipeline ──────────────────────────────────────────────────────────────

  fastify.get('/pipeline', {
    schema: {
      tags: ['Pipeline'],
      summary: 'Enrichment pipeline stages',
      response: {
        200: {
          type: 'object',
          properties: {
            batchSize: { type: 'integer' },
            stages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => ({
    batchSize: 25,
    stages: [
      {
        step: 'A',
        name: 'Load master data',
        description: 'VendorMaster + ChartOfAccount rows loaded once per job for this client.',
      },
      {
        step: 'B',
        name: 'Vendor code matching',
        description:
          'Special rule: "FOCUS POINT" → disambiguateFocusPoint() selects FV100001, 4001/F01, 4001/F05 or 4001/F06 by description keywords. ' +
          'All other vendors: Fuse.js fuzzy match over vendorName + aliases (threshold 0.35). ' +
          'Match score stored as vendorMatchScore.',
      },
      {
        step: 'C',
        name: 'GL code assignment',
        description:
          'assignGLCode(): 1) vendor_override — ChartOfAccount rows with vendorCodeOverride; ' +
          '2) keyword — description matches ChartOfAccount.keywords; ' +
          '3) payment_skip — PAYMENT rows skip GL assignment; ' +
          '4) fallback — unmatched rows get glMatchMethod=fallback.',
      },
      {
        step: 'D',
        name: 'Row routing',
        description:
          'routeRow(): status=approved if vendorCode AND glCode both resolved. ' +
          'status=needs_review if either is missing (triggers pending_review job state).',
      },
    ],
  }));

  // ── Routing Rules ─────────────────────────────────────────────────────────

  fastify.get('/routing-rules', {
    schema: {
      tags: ['Routing Rules'],
      summary: 'Row approval logic',
      response: {
        200: {
          type: 'object',
          properties: {
            approved: { type: 'string' },
            needs_review: { type: 'string' },
            jobStatusLogic: { type: 'string' },
            manualReview: { type: 'string' },
          },
        },
      },
    },
  }, async () => ({
    approved: 'vendorCode is resolved AND glCode is resolved',
    needs_review: 'vendorCode is null OR glCode is null',
    jobStatusLogic: 'If any needs_review row exists → Job.status=pending_review; else Job.status=complete',
    manualReview:
      'Reviewer uses PATCH /jobs/:id/rows/:rowId or POST /jobs/:id/rows/bulk-approve via the gateway. ' +
      'Row status changes to reviewed, glMatchMethod=manual.',
  }));

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`[Enrichment] Docs server  → http://localhost:${port}/docs`);
  } catch (err) {
    console.warn('[Enrichment] Could not start docs server:', (err as Error).message);
  }
}