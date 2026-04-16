import type { ChartOfAccount } from '@docuextract/db';
import type { GLMatchMethod } from '@docuextract/types';

export interface GLResult {
  glCode: string | null;
  glLabel: string | null;
  glMatchMethod: GLMatchMethod;
}

export function assignGLCode(
  vendorCode: string | null,
  documentCategory: string,
  documentDescription: string,
  chartOfAccounts: ChartOfAccount[],
): GLResult {
  // All document categories go through GL matching — PAYMENT rows included.
  // If no GL rule matches, the row will be routed to needs_review.

  // Priority 1: Vendor override — vendor always maps to this GL regardless of description
  if (vendorCode) {
    const vendorRule = chartOfAccounts.find(
      (r) => r.vendorCodeOverride === vendorCode,
    );
    if (vendorRule) {
      return {
        glCode: vendorRule.glCode,
        glLabel: vendorRule.glLabel,
        glMatchMethod: 'vendor_override',
      };
    }
  }

  // Priority 2: Keyword match on description
  const desc = documentDescription.toUpperCase();
  for (const rule of chartOfAccounts) {
    if (rule.keywords.length === 0) continue;
    if (rule.keywords.some((kw) => desc.includes(kw.toUpperCase()))) {
      return {
        glCode: rule.glCode,
        glLabel: rule.glLabel,
        glMatchMethod: 'keyword',
      };
    }
  }

  // Priority 3: Fallback — flag for human review
  return { glCode: null, glLabel: null, glMatchMethod: 'fallback' };
}