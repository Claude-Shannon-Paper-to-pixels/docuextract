import type { RawRow } from '@docuextract/types';

export function cleanupRows(rows: RawRow[]): RawRow[] {
  return rows.filter((row) => {
    const desc = (row.documentDescription || '').trim();

    // Rule 1: Skip Balance B/F rows
    if (/balance.*(b\/f|forward|brought)/i.test(desc)) return false;
    if (/^opening balance/i.test(desc)) return false;
    if (/^closing balance/i.test(desc)) return false;

    // Rule 2: Skip zero-amount rows
    if (!row.debit && !row.credit) return false;

    // Rule 3: Skip aging summary rows
    if (/^\d+\s*[-–]\s*\d+\s*days?/i.test(desc)) return false;
    if (/^(current|>\s*\d+\s*days?)/i.test(desc)) return false;

    // Rule 4: Skip subtotal/total lines
    if (
      /^(subtotal|total excl|total incl|tax amount|grand total|total amount)/i.test(
        desc,
      )
    )
      return false;
    if (/^total\s*$/i.test(desc)) return false;

    // Rule 5: Skip aging analysis headers
    if (/^aging\s*(analysis|summary)/i.test(desc)) return false;

    // Rule 6: Skip page number markers
    if (/^page\s*\d+\s*(of\s*\d+)?$/i.test(desc)) return false;

    return true;
  });
}

export function checkRowCountMismatch(
  cleanedRows: RawRow[],
  jobId: string,
): Set<string> {
  const byVendor = new Map<string, RawRow[]>();
  for (const row of cleanedRows) {
    const key = row.vendorNameRaw;
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(row);
  }

  const mismatchedVendors = new Set<string>();
  for (const [vendor, vendorRows] of byVendor) {
    const expected = vendorRows[0]?.lineItemsCount;
    if (expected && vendorRows.length < expected * 0.7) {
      console.warn(
        `[Job ${jobId}] Row count mismatch for "${vendor}": extracted ${vendorRows.length}, expected ~${expected}`,
      );
      mismatchedVendors.add(vendor);
    }
  }
  return mismatchedVendors;
}