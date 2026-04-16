import type { ReviewReason } from '@docuextract/types';

export interface RouteResult {
  status: 'approved' | 'needs_review';
  reviewReason: ReviewReason | null;
}

export function routeRow(
  vendorCode: string | null | undefined,
  glCode: string | null | undefined,
  confidence?: number | null,
  preTaggedReason?: string | null,
): RouteResult {
  // Pre-tagged at extraction stage (low confidence or row count mismatch)
  if (preTaggedReason === 'low_confidence' || preTaggedReason === 'row_count_mismatch') {
    return { status: 'needs_review', reviewReason: preTaggedReason as ReviewReason };
  }

  // All rows (PAYMENT and non-PAYMENT) must have both vendor and GL codes.
  // PAYMENT rows are no longer auto-approved — they also go through GL matching.
  if (!vendorCode) {
    return { status: 'needs_review', reviewReason: 'vendor_unmatched' };
  }
  if (!glCode) {
    return { status: 'needs_review', reviewReason: 'gl_unmatched' };
  }

  return { status: 'approved', reviewReason: null };
}