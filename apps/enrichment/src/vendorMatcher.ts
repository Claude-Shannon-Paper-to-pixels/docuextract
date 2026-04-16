import Fuse from 'fuse.js';
import type { VendorMaster } from '@docuextract/db';

interface SearchItem {
  vendorCode: string;
  vendorName: string;
  aliases: string[];
}

export interface VendorMatchResult {
  vendorCode: string;
  vendorNameMatched: string;
  vendorMatchScore: number; // 0–1, higher = more confident
}

export function buildFuseIndex(vendors: VendorMaster[]): Fuse<SearchItem> {
  const searchList: SearchItem[] = vendors.map((v) => ({
    vendorCode: v.vendorCode,
    vendorName: v.vendorName,
    aliases: v.aliases,
  }));

  return new Fuse(searchList, {
    keys: ['vendorName', 'aliases'],
    threshold: 0.35,     // 0 = exact match only, 1 = match anything
    includeScore: true,
    ignoreLocation: true, // don't penalise matches not at start of string
    minMatchCharLength: 4,
  });
}

export function matchVendor(
  rawName: string,
  fuse: Fuse<SearchItem>,
): VendorMatchResult | null {
  const results = fuse.search(rawName);
  if (results.length === 0 || results[0].score === undefined) return null;

  // Fuse score: 0 = perfect, 1 = total mismatch — reject if >= 0.35
  if (results[0].score >= 0.35) return null;

  const best = results[0];
  return {
    vendorCode: best.item.vendorCode,
    vendorNameMatched: best.item.vendorName,
    vendorMatchScore: 1 - best.score, // invert so 1.0 = perfect
  };
}