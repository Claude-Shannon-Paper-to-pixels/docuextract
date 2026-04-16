import type { RawRow, DocumentCategory } from '@docuextract/types';

// Strip markdown code blocks if Gemini wraps the CSV
function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:csv)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

// CSV line parser that handles quoted fields with embedded commas
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Normalise dates to YYYY-MM-DD
function normaliseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY or D/M/YYYY
  const ddmm = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmm) {
    return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`;
  }

  // DD-MM-YYYY
  const ddmmDash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmDash) {
    return `${ddmmDash[3]}-${ddmmDash[2].padStart(2, '0')}-${ddmmDash[1].padStart(2, '0')}`;
  }

  // Try native parse as fallback
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

export function parseGeminiCSV(csvText: string, outletCode: string): RawRow[] {
  const cleaned = stripMarkdown(csvText);
  const lines = cleaned.split('\n').filter((l) => l.trim() !== '');

  if (lines.length < 2) {
    console.warn('[Parser] Fewer than 2 lines in Gemini response — no data rows');
    return [];
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_'),
  );

  const get = (values: string[], field: string): string => {
    const idx = headers.indexOf(field);
    return idx >= 0 ? (values[idx] ?? '').trim() : '';
  };

  const getNum = (values: string[], field: string): number | undefined => {
    const val = get(values, field).replace(/[,\s]/g, '');
    const n = parseFloat(val);
    return isNaN(n) || n === 0 ? undefined : Math.abs(n);
  };

  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    const rawCategory = get(values, 'document_category').toUpperCase();
    const documentCategory: DocumentCategory =
      rawCategory === 'INVOICE'
        ? 'INVOICE'
        : rawCategory === 'CN'
          ? 'CN'
          : rawCategory === 'PAYMENT'
            ? 'PAYMENT'
            : 'SOA';

    const vendorName = get(values, 'vendor_name');
    if (!vendorName) continue;

    const debit = getNum(values, 'debit');
    const credit = getNum(values, 'credit');
    if (!debit && !credit) continue;

    rows.push({
      companyName: get(values, 'company_name') || 'MCT VISION SDN BHD',
      outletCode: get(values, 'outlet_code') || outletCode,
      documentCategory,
      documentType: get(values, 'document_type') || rawCategory || 'SOA',
      documentDescription: get(values, 'document_description'),
      invoiceNumber: get(values, 'invoice_number') || undefined,
      cnNumber: get(values, 'cn_number') || undefined,
      date: normaliseDate(get(values, 'date')),
      debit,
      credit,
      vendorNameRaw: vendorName,
      pageNumber: parseInt(get(values, 'page_number'), 10) || 0,
      lineItemsCount: parseInt(get(values, 'line_items_count'), 10) || undefined,
      confidence: parseFloat(get(values, 'confidence')) || 0.8,
      extractionRemarks: get(values, 'extraction_remarks') || undefined,
      fileName: get(values, 'file_name') || '',
    });
  }

  return rows;
}