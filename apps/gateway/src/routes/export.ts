import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '@docuextract/db';
import ExcelJS from 'exceljs';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  
}

export async function exportRoutes(fastify: FastifyInstance) {
  fastify.get('/jobs/:id/export', {
    preHandler: authenticate,
    schema: {
      tags: ['Export'],
      summary: 'Download approved transactions as Excel (.xlsx)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { type: 'string', format: 'binary', description: 'Excel file — save as .xlsx' },
        404: { $ref: 'ErrorResponse#' },
        401: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        jobId: id,
        status: { in: ['approved', 'reviewed'] },
      },
      orderBy: [{ pageNumber: 'asc' }, { date: 'asc' }],
    });

    if (transactions.length === 0) {
      return reply.status(404).send({ error: 'No approved transactions to export' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Company', key: 'company', width: 25 },
      { header: 'Outlet', key: 'outletCode', width: 10 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Doc No', key: 'invoiceNumber', width: 20 },
      { header: 'Description', key: 'documentDescription', width: 40 },
      { header: 'Vendor Code', key: 'vendorCode', width: 18 },
      { header: 'Vendor Name', key: 'vendorNameMatched', width: 40 },
      { header: 'Account Code', key: 'glCode', width: 14 },
      { header: 'Account Description', key: 'glLabel', width: 30 },
      { header: 'Debit', key: 'debit', width: 12 },
      { header: 'Credit', key: 'credit', width: 12 },
      { header: 'Category', key: 'documentCategory', width: 12 },
    ];

    for (const tx of transactions) {
      sheet.addRow({
        company: 'MCT VISION SDN BHD',
        outletCode: tx.outletCode,
        date: tx.date ? tx.date.toISOString().split('T')[0] : '',
        invoiceNumber: tx.invoiceNumber ?? tx.cnNumber ?? '',
        documentDescription: tx.documentDescription,
        vendorCode: tx.vendorCode ?? '',
        vendorNameMatched: tx.vendorNameMatched ?? '',
        glCode: tx.glCode ?? '',
        glLabel: tx.glLabel ?? '',
        debit: tx.debit ? Number(tx.debit) : 0,
        credit: tx.credit ? Number(tx.credit) : 0,
        documentCategory: tx.documentCategory,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `export_${job.outletCode}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Audit log
    const jwtUser = request.user as JwtPayload;
    await prisma.auditLog.create({
      data: {
        userId:    jwtUser.id,
        userEmail: jwtUser.email,
        action:    'export_job',
        detail:    job.originalFilename,
      },
    });

    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return reply.send(Buffer.from(buffer));
  });
}
