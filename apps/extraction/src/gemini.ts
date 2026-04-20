import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'node:fs';
import { MOCK_EXTRACTION_CSV } from './geminiMock.js';

// ─── Config from environment ──────────────────────────────────────────────────
// GEMINI_API_KEY        — required, your Gemini API key
// GEMINI_MODEL          — optional, defaults to gemini-2.0-flash
// GEMINI_TEMPERATURE    — optional, defaults to 0.1 (low = more deterministic CSV output)
// GEMINI_MAX_TOKENS     — optional, defaults to 8192
// GEMINI_MAX_PDF_MB     — optional, defaults to 20 (inline base64 size limit for single-call path)
// GEMINI_CHUNK_PAGES    — optional, defaults to 3 (pages per Gemini call; PDFs with more pages are split)




function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function getModelName(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
}

function getTemperature(): number {
  const raw = process.env.GEMINI_TEMPERATURE;
  if (!raw) return 0.1;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed < 0 || parsed > 2) {
    console.warn(`[Gemini] Invalid GEMINI_TEMPERATURE "${raw}" — using 0.1`);
    return 0.1;
  }
  return parsed;
}

function getMaxTokens(): number {
  const raw = process.env.GEMINI_MAX_TOKENS;
  if (!raw) return 8192;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1) {
    console.warn(`[Gemini] Invalid GEMINI_MAX_TOKENS "${raw}" — using 8192`);
    return 8192;
  }
  return parsed;
}

function getMaxPdfBytes(): number {
  const raw = process.env.GEMINI_MAX_PDF_MB;
  const mb = raw ? parseInt(raw, 10) : 20;
  if (isNaN(mb) || mb < 1) return 20 * 1024 * 1024;
  return mb * 1024 * 1024;
}

function getChunkPages(): number {
  const raw = process.env.GEMINI_CHUNK_PAGES;
  if (!raw) return 3;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1) {
    console.warn(`[Gemini] Invalid GEMINI_CHUNK_PAGES "${raw}" — using 3`);
    return 3;
  }
  return parsed;
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a financial document OCR assistant extracting transaction data from vendor statement PDFs for an accounting firm.

This PDF may contain statements from MULTIPLE vendors — each page or section belongs to a different vendor.

YOUR TASK: Extract every transaction line item from every page and return them as CSV.

=== WHAT TO EXTRACT ===
- Invoice entries (debit entries, amounts owed)
- Credit note entries (CN, credit entries)
- Payment/receipt entries (RV, OR, RC type, Direct Debit) — classify these as PAYMENT

=== WHAT TO SKIP (do NOT output these rows) ===
- "Balance B/F", "Balance Forward", "Brought Forward", "Opening Balance", "Closing Balance"
- Aging analysis rows (e.g. "Current", "0-30 days", "31-60 days", "61-90 days", "> 90 days")
- Grand Total, Subtotal, Total rows at the bottom of sections
- Rows where BOTH debit AND credit are zero or empty
- TIN, UUID, IRBM validation fields from e-Invoices (these are metadata, not transactions)

=== WHAT TO IGNORE ENTIRELY ===
- Handwritten annotations, pen-written dates or amounts
- Tick marks or checkmarks next to invoice numbers
- Rubber stamps, approval stamps
- The running balance column (do NOT put running balance values in credit or debit)

=== VENDOR DETECTION ===
Each page or section starts with a vendor letterhead/header. Detect the vendor company name from the letterhead.
Carry that vendor name for ALL rows on that page until a new vendor header appears.

=== DOCUMENT CATEGORY RULES ===
- "SOA"     — line from a Statement of Account (Date/DocNo/Debit/Credit columns)
- "INVOICE" — standalone invoice document
- "CN"      — standalone credit note, OR a credit note line within an SOA
- "PAYMENT" — payment receipt line (RV, OR, RC type, Direct Debit, receipt)

=== SPECIAL FORMAT HANDLING ===
Focus Point e-Invoice (INR/CNR prefix): Extract document code, date, description, amount per line item.
Single Amount column (no separate Debit/Credit): If invoice/outstanding → debit. If payment/credit → credit.
ILT Optics multi-page (100+ rows): Extract ALL rows — do not stop early.

=== OUTPUT FORMAT ===
Return ONLY a CSV. Start directly with the header line. No markdown, no code blocks, no preamble.

company_name,outlet_code,document_category,debit,credit,vendor_code,vendor_name,account_code,account_description,cn_number,invoice_number,date,line_items_count,calculation_trace,total_amount,document_type,document_description,file_name,page_number,confidence,extraction_remarks

=== FIELD RULES ===
- company_name: Client receiving the statements (e.g. "MCT VISION SDN BHD")
- outlet_code: From filename — "F5063" if filename contains F5063, "F5080" if F5080, else "UNKNOWN"
- document_category: SOA, INVOICE, CN, or PAYMENT
- debit: Positive number, no currency symbol (empty if not applicable)
- credit: Positive number, no currency symbol (empty if not applicable)
- vendor_code: LEAVE EMPTY
- vendor_name: Vendor company name exactly as shown in the page header/letterhead
- account_code: LEAVE EMPTY
- account_description: LEAVE EMPTY
- cn_number: Credit note reference number (only for CN entries, else empty)
- invoice_number: Invoice or document reference number
- date: Transaction date in YYYY-MM-DD format
- line_items_count: Estimated total transaction rows for this vendor's section
- calculation_trace: Brief note if you had to infer something (e.g. "single amount col - treated as debit")
- total_amount: The transaction amount (same as debit or credit value)
- document_type: Same as document_category
- document_description: Full description text from the transaction line
- file_name: The PDF filename (provided below)
- page_number: PDF page number (1-indexed) where this row appears
- confidence: Your confidence 0.0-1.0 this extraction is correct
- extraction_remarks: Notes about ambiguous fields or unusual formatting

=== CRITICAL ===
Extract EVERY single transaction row. For dense pages with 30+ rows, extract ALL rows.
If a vendor's table continues on the next page without a new letterhead, treat it as a continuation.
Wrap values containing commas in double quotes.
`;

// ─── PDF splitting helpers ────────────────────────────────────────────────────

async function splitPdfIntoChunks(
  pdfBuffer: Buffer,
  chunkSize: number,
  totalPages: number,
): Promise<{ buffer: Buffer; startPage: number; endPage: number }[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const chunks: { buffer: Buffer; startPage: number; endPage: number }[] = [];

  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages);
    const chunkDoc = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const copiedPages = await chunkDoc.copyPages(srcDoc, indices);
    copiedPages.forEach((page) => chunkDoc.addPage(page));
    const bytes = await chunkDoc.save();
    chunks.push({ buffer: Buffer.from(bytes), startPage: start + 1, endPage: end });
  }

  return chunks;
}

async function callGemini(
  model: GenerativeModel,
  pdfBuffer: Buffer,
  originalFilename: string,
  chunkNote?: string,
): Promise<string> {
  const base64Data = pdfBuffer.toString('base64');
  const prompt = chunkNote
    ? `${EXTRACTION_PROMPT}\n\nFilename: ${originalFilename}\n\nNote: ${chunkNote}`
    : `${EXTRACTION_PROMPT}\n\nFilename: ${originalFilename}`;

  const result = await model.generateContent([
    { inlineData: { mimeType: 'application/pdf', data: base64Data } },
    { text: prompt },
  ]);

  const text = result.response.text();
  if (!text || !text.trim()) {
    throw new Error('Gemini returned an empty response — check model availability and PDF content');
  }
  return text;
}

function mergeChunkedCSV(fragments: string[]): string {
  if (fragments.length === 0) return '';
  if (fragments.length === 1) return fragments[0];

  const allLines: string[] = [];
  for (let i = 0; i < fragments.length; i++) {
    const lines = fragments[i].split('\n').filter((l) => l.trim() !== '');
    if (i === 0) {
      allLines.push(...lines);
    } else {
      allLines.push(...lines.slice(1)); // strip header from subsequent chunks
    }
  }
  return allLines.join('\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function extractFromPDF(
  filePath: string,
  originalFilename: string,
): Promise<string> {
  // ─── Mock mode: bypass Gemini entirely ───────────────────────────────────
  // Set MOCK_GEMINI=true in .env to use fixture data (no API calls / quota used)
  // Set MOCK_GEMINI=false (or remove the line) to use real Gemini
  if (process.env.MOCK_GEMINI === 'true') {
    console.log(`[Gemini] MOCK MODE — returning fixture CSV for "${originalFilename}" (set MOCK_GEMINI=false to use real API)`);
    return MOCK_EXTRACTION_CSV;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const apiKey = getRequiredEnv('GEMINI_API_KEY');
  const modelName = getModelName();
  const temperature = getTemperature();
  const maxOutputTokens = getMaxTokens();
  const maxPdfBytes = getMaxPdfBytes();
  const chunkPages = getChunkPages();

  console.log(`[Gemini] Model: ${modelName} | Temp: ${temperature} | MaxTokens: ${maxOutputTokens} | ChunkPages: ${chunkPages}`);

  const pdfBuffer = fs.readFileSync(filePath);

  // Determine page count to choose single-call vs chunked path
  const pdfMeta = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfMeta.getPageCount();
  console.log(`[Gemini] "${originalFilename}" — ${totalPages} page(s) detected`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature, maxOutputTokens },
  });

  // ── Single-call path (PDF fits within chunk size) ────────────────────────
  if (totalPages <= chunkPages) {
    if (pdfBuffer.length > maxPdfBytes) {
      throw new Error(
        `PDF too large for inline processing: ${Math.round(pdfBuffer.length / 1024 / 1024)}MB` +
        ` (limit: ${Math.round(maxPdfBytes / 1024 / 1024)}MB — set GEMINI_MAX_PDF_MB to override)`,
      );
    }
    console.log(`[Gemini] Single-call mode (${totalPages} page(s) ≤ chunk size ${chunkPages})`);
    return callGemini(model, pdfBuffer, originalFilename);
  }

  // ── Chunked path (PDF exceeds chunk size) ───────────────────────────────
  const numChunks = Math.ceil(totalPages / chunkPages);
  console.log(`[Gemini] Chunked mode — ${totalPages} pages → ${numChunks} chunks of up to ${chunkPages} pages each`);

  const chunks = await splitPdfIntoChunks(pdfBuffer, chunkPages, totalPages);
  const csvFragments: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const { buffer, startPage, endPage } = chunks[i];
    console.log(`[Gemini] Chunk ${i + 1}/${chunks.length} — pages ${startPage}–${endPage}`);
    const chunkNote =
      `This chunk contains pages ${startPage}–${endPage} of a ${totalPages}-page PDF. ` +
      `Set the page_number field to the ORIGINAL page numbers (${startPage} through ${endPage}).`;
    const fragment = await callGemini(model, buffer, originalFilename, chunkNote);
    csvFragments.push(fragment);
  }

  console.log(`[Gemini] Merging ${csvFragments.length} CSV fragments`);
  return mergeChunkedCSV(csvFragments);
}