import { Worker, type Job } from 'bullmq';
import {
  redisConnection,
  EXTRACTION_QUEUE_NAME,
  enrichmentQueue,
} from '@docuextract/queue';
import { prisma } from '@docuextract/db';
import type { ExtractionJobData } from '@docuextract/types';
import * as fs from 'node:fs';
import { extractFromPDF } from './gemini.js';
import { parseGeminiCSV } from './parser.js';
import { cleanupRows, checkRowCountMismatch } from './cleanup.js';
import { startExtractionDocsServer } from './docs.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

// ─── Error helpers ────────────────────────────────────────────────────────────

/**
 * Detects a Gemini 429 rate-limit error and extracts the suggested retry delay.
 * Returns { is429: true, retryAfterMs } if rate limited, else { is429: false }.
 */
function parseRateLimitError(error: unknown): { is429: true; retryAfterMs: number } | { is429: false } {
  const message = error instanceof Error ? error.message : String(error);

  const is429 =
    message.includes('429') ||
    message.toLowerCase().includes('too many requests') ||
    message.toLowerCase().includes('quota exceeded');

  if (!is429) return { is429: false };

  // Gemini returns retryDelay in the error body — e.g. "retryDelay":"27s"
  const secondsMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  const retryAfterSeconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 60;

  // Add a small buffer on top of the suggested delay
  return { is429: true, retryAfterMs: (retryAfterSeconds + 5) * 1000 };
}

/**
 * Creates a retryable error that carries a BullMQ-compatible delay.
 * BullMQ reads the `retryDelay` property to schedule the next attempt.
 */
function makeRetryableError(message: string, delayMs: number): Error {
  return Object.assign(new Error(message), { retryDelay: delayMs });
}

// ─── Job processor ────────────────────────────────────────────────────────────

async function processExtractionJob(job: Job<ExtractionJobData>) {
  const { jobId, filePath, outletCode, originalFilename } = job.data;

  console.log(
    `[Extraction] Starting job ${jobId} (attempt ${job.attemptsMade + 1}/${MAX_ATTEMPTS}) — file: ${originalFilename}`,
  );

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'extracting' },
  });

  try {
    // Step 1: Call Gemini OCR
    await job.updateProgress(10);
    console.log(`[Extraction] Calling Gemini for job ${jobId}`);
    const csvText = await extractFromPDF(filePath, originalFilename);

    // Step 2: Parse CSV response
    await job.updateProgress(40);
    console.log(`[Extraction] Parsing response for job ${jobId}`);
    const rawRows = parseGeminiCSV(csvText, outletCode);
    console.log(`[Extraction] Parsed ${rawRows.length} raw rows`);

    // Step 3: Stage 1.5 cleanup
    const cleanedRows = cleanupRows(rawRows);
    console.log(`[Extraction] After cleanup: ${cleanedRows.length} rows`);
    const mismatchedVendors = checkRowCountMismatch(cleanedRows, jobId);
    const hasMismatch = mismatchedVendors.size > 0;

    if (hasMismatch) {
      console.warn(
        `[Extraction] Job ${jobId} has row count mismatch for vendors: ${[...mismatchedVendors].join(', ')}`,
      );
    }

    // Step 4: Get clientId from job record (merged with status check)
    const jobRecord = await prisma.job.findUnique({
      where: { id: jobId },
      select: { clientId: true },
    });
    if (!jobRecord) throw new Error(`Job record ${jobId} not found in DB`);

    // Step 5: Save rows to DB in batches
    await job.updateProgress(60);
    for (let i = 0; i < cleanedRows.length; i += BATCH_SIZE) {
      const batch = cleanedRows.slice(i, i + BATCH_SIZE);
      // Threshold below which we flag for human review at extraction stage
      const CONFIDENCE_THRESHOLD = 0.6;

      await prisma.transaction.createMany({
        data: batch.map((row) => {
          const isLowConfidence =
            row.confidence != null && row.confidence < CONFIDENCE_THRESHOLD;
          const isMismatch = mismatchedVendors.has(row.vendorNameRaw);

          // Pre-tag rows that are already known to need review
          const reviewReason = isLowConfidence
            ? 'low_confidence'
            : isMismatch
              ? 'row_count_mismatch'
              : null;

          return {
            jobId,
            outletCode: row.outletCode,
            pageNumber: row.pageNumber,
            date: new Date(row.date),
            documentDescription: row.documentDescription,
            invoiceNumber: row.invoiceNumber ?? null,
            cnNumber: row.cnNumber ?? null,
            debit: row.debit ?? null,
            credit: row.credit ?? null,
            documentCategory: row.documentCategory,
            documentType: row.documentType,
            vendorNameRaw: row.vendorNameRaw,
            vendorCode: null,
            vendorNameMatched: null,
            glCode: null,
            glLabel: null,
            status: 'raw',
            confidence: row.confidence ?? null,
            extractionRemarks: row.extractionRemarks ?? null,
            reviewReason,
          };
        }),
      });
      console.log(
        `[Extraction] Saved batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(cleanedRows.length / BATCH_SIZE)} for job ${jobId}`,
      );
    }

    // Step 5b: Delete the uploaded PDF now that all rows are safely in DB
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Extraction] Deleted uploaded file: ${filePath}`);
      }
    } catch (err) {
      console.warn(`[Extraction] Could not delete file ${filePath}:`, (err as Error).message);
    }

    // Step 6: Update job status → enriching
    await job.updateProgress(90);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'enriching',
        totalRows: cleanedRows.length,
        errorMessage: hasMismatch
          ? `Row count mismatch detected for: ${[...mismatchedVendors].join(', ')}`
          : null,
      },
    });

    // Step 7: Enqueue enrichment job
    await enrichmentQueue.add('enrich-transactions', {
      jobId,
      clientId: jobRecord.clientId,
    });

    await job.updateProgress(100);
    console.log(
      `[Extraction] Job ${jobId} complete — ${cleanedRows.length} rows saved, enrichment enqueued`,
    );
    return { rowCount: cleanedRows.length };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const rateLimit = parseRateLimitError(error);

    if (rateLimit.is429) {
      // Do NOT mark job as failed — it will be retried after the delay
      console.warn(
        `[Extraction] Job ${jobId} rate-limited by Gemini — ` +
        `retrying in ${Math.round(rateLimit.retryAfterMs / 1000)}s ` +
        `(attempt ${job.attemptsMade + 1}/${MAX_ATTEMPTS})`,
      );

      // If we've used all attempts, mark as failed so it doesn't loop forever
      if (job.attemptsMade + 1 >= MAX_ATTEMPTS) {
        console.error(`[Extraction] Job ${jobId} exhausted all ${MAX_ATTEMPTS} attempts due to rate limiting`);
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            errorMessage: `Gemini rate limit exceeded after ${MAX_ATTEMPTS} attempts. Please retry later or upgrade your API quota.`,
          },
        });
        // Throw plain error — no more retries
        throw new Error(message);
      }

      // Throw with retryDelay — BullMQ will reschedule automatically
      throw makeRetryableError(message, rateLimit.retryAfterMs);
    }

    // Non-429 failure — mark as failed immediately
    console.error(`[Extraction] Job ${jobId} FAILED: ${message}`);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: message },
    });
    throw error;
  }
}

// ─── Worker setup ─────────────────────────────────────────────────────────────

const worker = new Worker<ExtractionJobData>(
  EXTRACTION_QUEUE_NAME,
  processExtractionJob,
  {
    connection: redisConnection,

    // Keep concurrency at 1 to avoid burning quota on parallel requests.
    // Raise to 2 only after confirming you have paid-tier quota headroom.
    concurrency: 1,

    settings: {
      backoffStrategy: (attemptsMade: number, _type: string, err: Error) => {
        // If our rate-limit handler attached a retryDelay, honour it exactly
        const delay = (err as any).retryDelay;
        if (typeof delay === 'number') return delay;

        // Exponential backoff for all other transient errors: 5s, 10s, 20s
        return Math.pow(2, attemptsMade) * 5_000;
      },
    },
  },
);

// ─── Worker event listeners ───────────────────────────────────────────────────

worker.on('completed', (job, result) => {
  console.log(`[Extraction] Job ${job.id} completed — ${result.rowCount} rows`);
});

worker.on('failed', (job, err) => {
  console.error(`[Extraction] Job ${job?.id} failed after ${job?.attemptsMade} attempt(s):`, err.message);
});

worker.on('error', (err) => {
  console.error('[Extraction] Worker error:', err);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log('[Extraction] Shutting down worker gracefully...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Extraction] Worker started, listening on extraction-queue');

// Start docs/health server alongside the worker
startExtractionDocsServer();