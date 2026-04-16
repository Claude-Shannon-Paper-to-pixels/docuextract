import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// ─── Extraction Service Docs Server ──────────────────────────────────────────
// Runs alongside the BullMQ worker on DOCS_PORT (default 3001).
// Exposes Swagger UI at http://localhost:3001/docs documenting the queue
// contract, pipeline stages, and active configuration.

export async function startExtractionDocsServer(): Promise<void> {
  const port = Number.parseInt(process.env.DOCS_PORT ?? '3001', 10);
  const fastify = Fastify({ logger: false });

  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'DocuExtract — Extraction Service',
        version: '0.1.0',
        description:
          'Internal BullMQ worker that processes uploaded PDF statements via Gemini AI OCR.\n\n' +
          '**This service has no public HTTP API.** It consumes jobs from `extraction-queue` ' +
          'and pushes results to `enrichment-queue`.\n\n' +
          'Use the endpoints below to inspect the queue contract, pipeline stages, and live config.\n\n' +
          '**Mock mode:** Set `MOCK_GEMINI=true` in `.env` to skip Gemini and return fixture CSV ' +
          '(useful when free-tier quota is exhausted).',
      },
      servers: [{ url: `http://localhost:${port}`, description: 'Extraction service docs' }],
      tags: [
        { name: 'Health', description: 'Service health and live configuration' },
        { name: 'Queue Contract', description: 'BullMQ job input/output schemas' },
        { name: 'Pipeline', description: 'Processing pipeline stage reference' },
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
            service: { type: 'string', examples: ['extraction'] },
            status: { type: 'string', examples: ['ok'] },
            queue: { type: 'string', examples: ['extraction-queue'] },
            mockMode: { type: 'boolean', description: 'true when MOCK_GEMINI=true' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => ({
    service: 'extraction',
    status: 'ok',
    queue: 'extraction-queue',
    mockMode: process.env.MOCK_GEMINI === 'true',
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
            GEMINI_MODEL: { type: 'string' },
            GEMINI_TEMPERATURE: { type: 'string' },
            GEMINI_MAX_TOKENS: { type: 'string' },
            GEMINI_MAX_PDF_MB: { type: 'string' },
            MOCK_GEMINI: { type: 'string' },
            GEMINI_API_KEY: { type: 'string', description: 'Redacted' },
            REDIS_URL: { type: 'string', description: 'Redacted' },
          },
        },
      },
    },
  }, async () => ({
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    GEMINI_TEMPERATURE: process.env.GEMINI_TEMPERATURE ?? '0.1',
    GEMINI_MAX_TOKENS: process.env.GEMINI_MAX_TOKENS ?? '8192',
    GEMINI_MAX_PDF_MB: process.env.GEMINI_MAX_PDF_MB ?? '20',
    MOCK_GEMINI: process.env.MOCK_GEMINI ?? 'false',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '***set***' : '***NOT SET***',
    REDIS_URL: process.env.REDIS_URL ? '***set***' : '***NOT SET***',
  }));

  // ── Queue Contract ────────────────────────────────────────────────────────

  fastify.get('/queue/input', {
    schema: {
      tags: ['Queue Contract'],
      summary: 'ExtractionJobData — what to push to extraction-queue',
      description:
        'The gateway enqueues this automatically after a PDF upload. ' +
        'You do not push to this queue directly during normal use.',
      response: {
        200: {
          type: 'object',
          required: ['jobId', 'filePath', 'outletCode', 'originalFilename'],
          properties: {
            jobId: {
              type: 'string', format: 'uuid',
              description: 'UUID of the Job record in the database',
              examples: ['3018dd4e-7cf3-44c4-958a-36ea8c79892e'],
            },
            filePath: {
              type: 'string',
              description: 'Absolute path to the uploaded PDF on disk',
              examples: ['/uploads/3018dd4e-7cf3-44c4-958a-36ea8c79892e.pdf'],
            },
            outletCode: {
              type: 'string',
              description: 'Outlet code auto-detected from filename (F-prefix pattern)',
              examples: ['F5063'],
            },
            originalFilename: {
              type: 'string',
              description: 'Original filename passed to Gemini for context',
              examples: ['MCT_F5063_Dec2025.pdf'],
            },
          },
        },
      },
    },
  }, async () => ({
    jobId: '3018dd4e-7cf3-44c4-958a-36ea8c79892e',
    filePath: '/uploads/3018dd4e-7cf3-44c4-958a-36ea8c79892e.pdf',
    outletCode: 'F5063',
    originalFilename: 'MCT_F5063_Dec2025.pdf',
  }));

  fastify.get('/queue/output', {
    schema: {
      tags: ['Queue Contract'],
      summary: 'Return value on successful job completion',
      response: {
        200: {
          type: 'object',
          properties: {
            rowCount: {
              type: 'integer',
              description: 'Number of Transaction rows saved to the database',
              examples: [42],
            },
          },
        },
      },
    },
  }, async () => ({ rowCount: 42 }));

  fastify.get('/queue/retry-strategy', {
    schema: {
      tags: ['Queue Contract'],
      summary: 'Retry and backoff strategy',
      response: {
        200: {
          type: 'object',
          properties: {
            maxAttempts: { type: 'integer' },
            concurrency: { type: 'integer' },
            rateLimitHandling: { type: 'string' },
            backoff: { type: 'string' },
          },
        },
      },
    },
  }, async () => ({
    maxAttempts: 3,
    concurrency: 1,
    rateLimitHandling: 'Gemini 429 errors parsed for retryDelay; BullMQ reschedules after suggested delay + 5s buffer',
    backoff: 'Exponential: 5s → 10s → 20s for non-429 errors; exact Gemini delay for 429s',
  }));

  // ── Pipeline ──────────────────────────────────────────────────────────────

  fastify.get('/pipeline', {
    schema: {
      tags: ['Pipeline'],
      summary: 'Extraction pipeline stages',
      response: {
        200: {
          type: 'object',
          properties: {
            stages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'integer' },
                  name: { type: 'string' },
                  progress: { type: 'string' },
                  description: { type: 'string' },
                  mockBehaviour: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => ({
    stages: [
      {
        step: 1,
        name: 'Gemini OCR',
        progress: '10%',
        description: 'PDF read from disk, base64-encoded, sent to Gemini generateContent API. Returns raw CSV text.',
        mockBehaviour: 'When MOCK_GEMINI=true, returns fixture CSV from geminiMock.ts immediately — no API call.',
      },
      {
        step: 2,
        name: 'CSV Parse',
        progress: '40%',
        description: 'Raw CSV parsed into typed RawRow objects via parseGeminiCSV(). Outlet code overridden from job data.',
        mockBehaviour: 'Same — fixture CSV goes through the same parser.',
      },
      {
        step: 3,
        name: 'Cleanup',
        progress: '50%',
        description: 'cleanupRows() normalises dates, trims whitespace, strips balance rows. checkRowCountMismatch() flags anomalies.',
        mockBehaviour: 'Same.',
      },
      {
        step: 4,
        name: 'DB Save',
        progress: '60–90%',
        description: 'Cleaned rows saved to Transaction table (status=raw) in batches of 50 via prisma.transaction.createMany().',
        mockBehaviour: 'Same — all 6 fixture rows are saved.',
      },
      {
        step: 5,
        name: 'Enrich Enqueue',
        progress: '100%',
        description: 'Job status updated to enriching. EnrichmentJobData pushed to enrichment-queue.',
        mockBehaviour: 'Same — enrichment fires normally.',
      },
    ],
  }));

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`[Extraction] Docs server  → http://localhost:${port}/docs`);
  } catch (err) {
    console.warn('[Extraction] Could not start docs server:', (err as Error).message);
  }
}
