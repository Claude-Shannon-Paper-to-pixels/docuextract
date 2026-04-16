import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '@docuextract/db';
import { extractionQueue } from '@docuextract/queue';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  clientId?: string;
}

export async function jobsRoutes(fastify: FastifyInstance) {
  // GET /clients — list all clients (used by frontend dashboard)
  fastify.get('/clients', {
    preHandler: authenticate,
    schema: {
      tags: ['Jobs'],
      summary: 'List all clients',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (_request, reply) => {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true },
    });
    return clients;
  });

  // GET /jobs/:id/status — returns job status + row counts
  fastify.get('/jobs/:id/status', {
    preHandler: authenticate,
    schema: {
      tags: ['Jobs'],
      summary: 'Get job status and row counts',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid', description: 'Job ID returned by /upload' } },
      },
      response: {
        200: { $ref: 'Job#' },
        404: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalRows: true,
        approvedRows: true,
        reviewRows: true,
        errorMessage: true,
        originalFilename: true,
        outletCode: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return job;
  });

  // GET /jobs — list recent jobs for the user's client
  fastify.get('/jobs', {
    preHandler: authenticate,
    schema: {
      tags: ['Jobs'],
      summary: 'List recent jobs for the authenticated client (last 50)',
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'array', items: { $ref: 'Job#' } },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const jwtUser = request.user as JwtPayload;
    const clientId = jwtUser.clientId ?? 'mct-vision-client-id';

    const jobs = await prisma.job.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        originalFilename: true,
        outletCode: true,
        totalRows: true,
        approvedRows: true,
        reviewRows: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return jobs;
  });

  // GET /jobs/:id/rows — get transaction rows for a job (for review page)
  fastify.get('/jobs/:id/rows', {
    preHandler: authenticate,
    schema: {
      tags: ['Jobs'],
      summary: 'Get all transaction rows for a job',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['raw', 'approved', 'needs_review', 'reviewed'],
            description: 'Filter rows by status (omit for all)',
          },
        },
      },
      response: {
        200: { type: 'array', items: { $ref: 'Transaction#' } },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.query as { status?: string };

    const whereClause: Record<string, unknown> = { jobId: id };
    if (status) {
      whereClause.status = status;
    }

    const rows = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: [{ pageNumber: 'asc' }, { date: 'asc' }],
    });

    return rows;
  });


    // POST /jobs/:id/retry — re-trigger extraction for a failed job
  fastify.post('/jobs/:id/retry', {
    preHandler: authenticate,
    schema: {
      tags: ['Jobs'],
      summary: 'Re-trigger extraction for a failed job',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true, fileUrl: true, outletCode: true, originalFilename: true },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (job.status !== 'failed') {
      return reply.status(400).send({
        error: `Job cannot be retried — current status is "${job.status}". Only failed jobs can be retried.`,
      });
    }

    // Reset job state
    await prisma.job.update({
      where: { id },
      data: {
        status: 'queued',
        errorMessage: null,
        totalRows: 0,
        approvedRows: 0,
        reviewRows: 0,
        completedAt: null,
      },
    });

    // Delete any partial transaction rows from the failed attempt
    await prisma.transaction.deleteMany({ where: { jobId: id } });

    // Re-enqueue extraction
    await extractionQueue.add('extract-pdf', {
      jobId: id,
      filePath: job.fileUrl,
      outletCode: job.outletCode,
      originalFilename: job.originalFilename,
    });

    return reply.status(200).send({ jobId: id, status: 'queued', message: 'Job re-queued for extraction' });
  });
}
