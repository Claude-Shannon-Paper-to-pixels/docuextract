import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '@docuextract/db';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

interface ReviewBody {
  vendorCode?: string;
  vendorNameMatched?: string;
  glCode?: string;
  glLabel?: string;
}

export async function reviewRoutes(fastify: FastifyInstance) {
  // PATCH /jobs/:id/rows/:rowId — reviewer approves or corrects a flagged row
  fastify.patch(
    '/jobs/:id/rows/:rowId',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Review'],
        summary: 'Correct a single transaction row',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'rowId'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Job ID' },
            rowId: { type: 'string', format: 'uuid', description: 'Transaction row ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            vendorCode: { type: 'string', examples: ['4000/I01'] },
            vendorNameMatched: { type: 'string', examples: ['ILT OPTICS (M) SDN BHD'] },
            glCode: { type: 'string', examples: ['6011/000'] },
            glLabel: { type: 'string', examples: ['Purchases - Other Supplies'] },
          },
        },
        response: {
          200: { $ref: 'Transaction#' },
          404: { $ref: 'ErrorResponse#' },
          401: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request, reply) => {
      const { id, rowId } = request.params as { id: string; rowId: string };
      const body = request.body as ReviewBody;
      const jwtUser = request.user as JwtPayload;

      // Verify job exists
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      // Verify row belongs to this job
      const row = await prisma.transaction.findFirst({
        where: { id: rowId, jobId: id },
      });
      if (!row) {
        return reply.status(404).send({ error: 'Transaction not found' });
      }

      // Validate: all rows must have both glCode and glLabel (PAYMENT included)
      const resolvedGlCode = body.glCode ?? row.glCode;
      const resolvedGlLabel = body.glLabel ?? row.glLabel;
      if (!resolvedGlCode || !resolvedGlLabel) {
        return reply.status(400).send({
          error: 'glCode and glLabel are required',
        });
      }

      // Validate: vendor must be resolved before approving
      const resolvedVendorCode = body.vendorCode ?? row.vendorCode;
      const resolvedVendorName = body.vendorNameMatched ?? row.vendorNameMatched;
      if (!resolvedVendorCode || !resolvedVendorName) {
        return reply.status(400).send({
          error: 'vendorCode and vendorNameMatched are required',
        });
      }

      // Update the row
      const updated = await prisma.transaction.update({
        where: { id: rowId },
        data: {
          ...(body.vendorCode !== undefined && { vendorCode: body.vendorCode }),
          ...(body.vendorNameMatched !== undefined && { vendorNameMatched: body.vendorNameMatched }),
          ...(body.glCode !== undefined && { glCode: body.glCode }),
          ...(body.glLabel !== undefined && { glLabel: body.glLabel }),
          glMatchMethod: 'manual',
          status: 'reviewed',
          reviewedById: jwtUser.id,
          reviewedAt: new Date(),
        },
      });

      // Check if all needs_review rows are now resolved
      const pendingCount = await prisma.transaction.count({
        where: { jobId: id, status: 'needs_review' },
      });

      if (pendingCount === 0) {
        // Final integrity guard: ensure no reviewed row (any category) has null glCode
        const invalidCount = await prisma.transaction.count({
          where: {
            jobId: id,
            status: 'reviewed',
            glCode: null,
          },
        });

        if (invalidCount > 0) {
          // Re-flag those rows rather than silently marking the job complete
          await prisma.transaction.updateMany({
            where: {
              jobId: id,
              status: 'reviewed',
              glCode: null,
            },
            data: { status: 'needs_review', reviewReason: 'gl_unmatched' },
          });
          // Job stays pending_review
        } else {
          const reviewedCount = await prisma.transaction.count({
            where: { jobId: id, status: 'reviewed' },
          });
          const approvedCount = await prisma.transaction.count({
            where: { jobId: id, status: 'approved' },
          });

          await prisma.job.update({
            where: { id },
            data: {
              status: 'complete',
              approvedRows: approvedCount + reviewedCount,
              reviewRows: reviewedCount,
              completedAt: new Date(),
            },
          });
        }
      }

      return updated;
    },
  );

  // GET /jobs/:id/rows/pending — get only needs_review rows for the review queue
  fastify.get(
    '/jobs/:id/rows/pending',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Review'],
        summary: 'Get all needs_review rows for a job',
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
              total: { type: 'integer' },
              rows: { type: 'array', items: { $ref: 'Transaction#' } },
            },
          },
          401: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const rows = await prisma.transaction.findMany({
        where: { jobId: id, status: 'needs_review' },
        orderBy: [{ pageNumber: 'asc' }],
      });

      return { total: rows.length, rows };
    },
  );

  // POST /jobs/:id/rows/bulk-approve — approve all needs_review rows for a vendor at once
  fastify.post(
    '/jobs/:id/rows/bulk-approve',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Review'],
        summary: 'Bulk approve all needs_review rows (optionally filtered by vendor)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['vendorCode', 'vendorNameMatched', 'glCode', 'glLabel'],
          properties: {
            vendorNameRaw: { type: 'string', description: 'If provided, only rows with this raw vendor name are updated' },
            vendorCode: { type: 'string', examples: ['VTLO10010330'] },
            vendorNameMatched: { type: 'string', examples: ['PEARLVISION OPTHALMIC LENS SDN. BHD.'] },
            glCode: { type: 'string', examples: ['6011/000'] },
            glLabel: { type: 'string', examples: ['Purchases - Other Supplies'] },
          },
        },
        response: {
          200: { type: 'object', properties: { updatedCount: { type: 'integer' } } },
          400: { $ref: 'ErrorResponse#' },
          404: { $ref: 'ErrorResponse#' },
          401: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        vendorNameRaw?: string;
        vendorCode: string;
        vendorNameMatched: string;
        glCode: string;
        glLabel: string;
      };
      const jwtUser = request.user as JwtPayload;

      if (!body.vendorCode || !body.vendorNameMatched || !body.glCode || !body.glLabel) {
        return reply.status(400).send({ error: 'vendorCode, vendorNameMatched, glCode, glLabel are required' });
      }

      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      const whereClause: Record<string, unknown> = { jobId: id, status: 'needs_review' };
      if (body.vendorNameRaw) {
        whereClause.vendorNameRaw = body.vendorNameRaw;
      }

      const updated = await prisma.transaction.updateMany({
        where: whereClause,
        data: {
          vendorCode: body.vendorCode,
          vendorNameMatched: body.vendorNameMatched,
          glCode: body.glCode,
          glLabel: body.glLabel,
          glMatchMethod: 'manual',
          status: 'reviewed',
          reviewedById: jwtUser.id,
          reviewedAt: new Date(),
        },
      });

      // If no more needs_review rows, run integrity guard then mark job complete
      const pendingCount = await prisma.transaction.count({
        where: { jobId: id, status: 'needs_review' },
      });

      if (pendingCount === 0) {
        // Integrity guard: ensure no reviewed row has null glCode
        const invalidCount = await prisma.transaction.count({
          where: { jobId: id, status: 'reviewed', glCode: null },
        });

        if (invalidCount > 0) {
          await prisma.transaction.updateMany({
            where: { jobId: id, status: 'reviewed', glCode: null },
            data: { status: 'needs_review', reviewReason: 'gl_unmatched' },
          });
          // Job stays pending_review
        } else {
          const reviewedCount = await prisma.transaction.count({ where: { jobId: id, status: 'reviewed' } });
          const approvedCount = await prisma.transaction.count({ where: { jobId: id, status: 'approved' } });

          await prisma.job.update({
            where: { id },
            data: {
              status: 'complete',
              approvedRows: approvedCount + reviewedCount,
              reviewRows: reviewedCount,
              completedAt: new Date(),
            },
          });
        }
      }

      return { updatedCount: updated.count };
    },
  );

  // GET /jobs/:id/review-summary — breakdown of needs_review rows by reason
  fastify.get(
    '/jobs/:id/review-summary',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Review'],
        summary: 'Get a breakdown of needs_review rows grouped by review reason',
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
              total: { type: 'integer' },
              byReason: {
                type: 'object',
                properties: {
                  vendor_unmatched:    { type: 'integer' },
                  gl_unmatched:        { type: 'integer' },
                  low_confidence:      { type: 'integer' },
                  row_count_mismatch:  { type: 'integer' },
                  unknown:             { type: 'integer' },
                },
              },
            },
          },
          401: { $ref: 'ErrorResponse#' },
          404: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      const rows = await prisma.transaction.findMany({
        where: { jobId: id, status: 'needs_review' },
        select: { reviewReason: true },
      });

      const byReason = {
        vendor_unmatched:   0,
        gl_unmatched:       0,
        low_confidence:     0,
        row_count_mismatch: 0,
        unknown:            0,
      };

      for (const row of rows) {
        const key = row.reviewReason ?? 'unknown';
        if (key in byReason) {
          (byReason as Record<string, number>)[key]++;
        } else {
          byReason.unknown++;
        }
      }

      return { total: rows.length, byReason };
    },
  );
}
