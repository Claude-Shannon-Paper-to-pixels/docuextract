/**
 * Focus Point Vision Care Group appears with 4 different vendor codes:
 *   FV100001  — Trade (lens/product invoices, IV prefix)
 *   4001/F01  — Non-Trade (rental, sales commission, bonuslink, rebills)
 *   4001/F05  — Royalty + Sinking Fund
 *   4001/F06  — Franchise Fee
 *
 * This must be resolved BEFORE running Fuse.js.
 */
export function disambiguateFocusPoint(
  description: string,
  invoiceNumber: string,
): string {
  const desc = description.toUpperCase();
  const docNo = (invoiceNumber || '').toUpperCase();

  // Royalty and sinking fund → 4001/F05
  if (/royalty|sinking fund|outlet maintenance deposit/i.test(desc)) {
    return '4001/F05';
  }

  // Franchise fee → 4001/F06
  if (/franchise fee/i.test(desc)) {
    return '4001/F06';
  }

  // INR/CNR/OI/BR doc number prefixes = Non-Trade invoices/credit notes
  if (/^(INR|CNR|OI|BR)/.test(docNo)) {
    return '4001/F01';
  }

  // Non-Trade description keywords
  if (/rental|sales comm|bonuslink|rebill|non.?trade/i.test(desc)) {
    return '4001/F01';
  }

  // IV prefix = Trade (HQ lens purchase invoices)
  if (/^IV/.test(docNo) || /\btrade\b/i.test(desc)) {
    return 'FV100001';
  }

  // Default — Non-Trade is more common than Trade for ambiguous FP rows
  return '4001/F01';
}