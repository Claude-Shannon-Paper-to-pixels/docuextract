import { Worker, type Job } from 'bullmq';
import { redisConnection, ENRICHMENT_QUEUE_NAME } from '@docuextract/queue';
import { prisma } from '@docuextract/db';
import type { EnrichmentJobData } from '@docuextract/types';
import { buildFuseIndex, matchVendor } from './vendorMatcher.js';
import { disambiguateFocusPoint } from './specialRules.js';
import { assignGLCode } from './glMapper.js';
import { routeRow } from './router.js';
import { startEnrichmentDocsServer } from './docs.js';

async function processEnrichmentJob(job: Job<EnrichmentJobData>) {
  const { jobId, clientId } = job.data;
  console.log(`[Enrichment] Starting job ${jobId}`);

  try {
    // Load vendor master + GL rules once for this client
    const [vendorMasters, chartOfAccounts] = await Promise.all([
      prisma.vendorMaster.findMany({ where: { clientId } }),
      prisma.chartOfAccount.findMany({ where: { clientId } }),
    ]);

    console.log(
      `[Enrichment] Loaded ${vendorMasters.length} vendors, ${chartOfAccounts.length} GL rules`,
    );

    // Build Fuse.js index from vendor master
    const fuse = buildFuseIndex(vendorMasters);

    // Fetch all raw transactions for this job
    const transactions = await prisma.transaction.findMany({
      where: { jobId, status: 'raw' },
    });

    console.log(`[Enrichment] Processing ${transactions.length} transactions`);

    if (transactions.length === 0) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'complete', completedAt: new Date() },
      });
      return;
    }

    let approvedCount = 0;
    let reviewCount = 0;

    // Process in batches to avoid overwhelming the DB
    const BATCH_SIZE = 25;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const updates = [];

      for (const tx of batch) {
        // ── Stage B: Vendor Code Matching ──────────────────────────────
        let vendorCode: string | null = null;
        let vendorNameMatched: string | null = null;
        let vendorMatchScore: number | null = null;

        const rawNameUpper = tx.vendorNameRaw.toUpperCase();

        if (rawNameUpper.includes('FOCUS POINT')) {
          // Special rule: disambiguate Focus Point by description/doc number
          const fpCode = disambiguateFocusPoint(
            tx.documentDescription,
            tx.invoiceNumber ?? '',
          );
          const fpVendor = vendorMasters.find((v) => v.vendorCode === fpCode);
          if (fpVendor) {
            vendorCode = fpVendor.vendorCode;
            vendorNameMatched = fpVendor.vendorName;
            vendorMatchScore = 1.0; // rule-based = maximum confidence
          }
        } else {
          // General case: Fuse.js fuzzy match
          const match = matchVendor(tx.vendorNameRaw, fuse);
          if (match) {
            vendorCode = match.vendorCode;
            vendorNameMatched = match.vendorNameMatched;
            vendorMatchScore = match.vendorMatchScore;
          }
        }

        // ── Stage C: GL Code Assignment ────────────────────────────────
        const glResult = assignGLCode(
          vendorCode,
          tx.documentCategory,
          tx.documentDescription,
          chartOfAccounts,
        );

        // ── Stage D: Routing ───────────────────────────────────────────
        const routeResult = routeRow(
          vendorCode,
          glResult.glCode,
          tx.confidence,
          tx.reviewReason,
        );
        const { status, reviewReason } = routeResult;

        if (status === 'approved') approvedCount++;
        else reviewCount++;

        updates.push(
          prisma.transaction.update({
            where: { id: tx.id },
            data: {
              vendorCode,
              vendorNameMatched,
              vendorMatchScore,
              glCode: glResult.glCode,
              glLabel: glResult.glLabel,
              glMatchMethod: glResult.glMatchMethod,
              status,
              reviewReason,
            },
          }),
        );
      }

      // Commit this batch in one DB round-trip
      await prisma.$transaction(updates);

      await job.updateProgress(
        Math.round(((i + batch.length) / transactions.length) * 100),
      );

      console.log(
        `[Enrichment] Batch ${i}–${i + batch.length} done (${approvedCount} approved, ${reviewCount} review so far)`,
      );
    }

    // Determine final job status
    const jobStatus = reviewCount > 0 ? 'pending_review' : 'complete';

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: jobStatus,
        approvedRows: approvedCount,
        reviewRows: reviewCount,
        completedAt: jobStatus === 'complete' ? new Date() : null,
      },
    });

    console.log(
      `[Enrichment] Job ${jobId} complete — ${approvedCount} approved, ${reviewCount} needs_review → ${jobStatus}`,
    );
  } catch (err) {
    console.error(`[Enrichment] Job ${jobId} failed:`, err);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err; // Let BullMQ handle retries
  }
}

const worker = new Worker<EnrichmentJobData>(
  ENRICHMENT_QUEUE_NAME,
  processEnrichmentJob,
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

worker.on('completed', (job) => {
  console.log(`[Enrichment] Worker completed job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[Enrichment] Worker failed job ${job?.id}:`, err.message);
});

console.log('[Enrichment] Worker started, listening on enrichment-queue...');

// Start docs/health server alongside the worker
startEnrichmentDocsServer();