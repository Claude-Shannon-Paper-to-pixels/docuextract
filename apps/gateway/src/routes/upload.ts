import { FastifyInstance } from 'fastify';
import { saveUploadedFile } from '../utils/fileStorage.js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '@docuextract/db';
import { extractionQueue } from '@docuextract/queue';

// JWT payload shape
interface JwtPayload {
  id: string;
  email: string;
  role: string;
  clientId?: string;
}

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/upload', {
    preHandler: authenticate,
    schema: {
      tags: ['Upload'],
      summary: 'Upload a PDF statement for extraction',
      description:
        'Send as `multipart/form-data`. The `file` field must be a PDF.\n\n' +
        'Include the outlet code in the filename (e.g. `MCT_F5063_Dec2025.pdf`) ' +
        'so the outlet code is auto-detected.',
      security: [{ bearerAuth: [] }],
      response: {
        201: {
          type: 'object',
          properties: {
            jobId: { type: 'string', format: 'uuid' },
            outletCode: { type: 'string', examples: ['F5063'] },
            status: { type: 'string', examples: ['queued'] },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    if (!data.filename.toLowerCase().endsWith('.pdf')) {
      return reply.status(400).send({ error: 'Only PDF files are accepted' });
    }

    // Extract outlet code from filename (e.g., MCT_MUTIARA_F5063_AI.pdf -> F5063)
    const outletMatch = data.filename.match(/F(\d{4})/);
    const outletCode = outletMatch ? `F${outletMatch[1]}` : 'UNKNOWN';

    // Save file locally (no MinIO for now — local storage for testing)
    const { jobId, filePath } = await saveUploadedFile(data);

    // Use requesting user's clientId if available, otherwise fall back to the seeded MCT Vision client
    const jwtUser = request.user as JwtPayload;
    const clientId = jwtUser.clientId ?? 'mct-vision-client-id';

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return reply.status(400).send({ error: 'Client not found. Please run the database seed first.' });
    }

    // Create job record
    const job = await prisma.job.create({
      data: {
        id: jobId,
        clientId,
        outletCode,
        fileUrl: filePath,
        originalFilename: data.filename,
        status: 'queued',
        totalRows: 0,
        approvedRows: 0,
        reviewRows: 0,
      },
    });

    // Enqueue extraction job
    await extractionQueue.add('extract-pdf', {
      jobId,
      filePath,
      outletCode,
      originalFilename: data.filename,
    });

    return reply.status(201).send({ jobId: job.id, outletCode, status: 'queued' });
  });
}
