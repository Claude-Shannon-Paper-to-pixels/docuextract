// Job status values
export type JobStatus =
  | 'queued'
  | 'extracting'
  | 'enriching'
  | 'pending_review'
  | 'complete'
  | 'failed';

// Transaction row status
export type TransactionStatus = 'raw' | 'approved' | 'needs_review' | 'reviewed';

// Document categories
export type DocumentCategory = 'SOA' | 'INVOICE' | 'CN' | 'PAYMENT';

// GL match method
export type GLMatchMethod = 'vendor_override' | 'keyword' | 'fallback' | 'manual' | 'payment_skip';

// Review reason — why a row was flagged for human review
export type ReviewReason = 'vendor_unmatched' | 'gl_unmatched' | 'low_confidence' | 'row_count_mismatch';

// User roles
export type UserRole = 'admin' | 'reviewer';

// Creditor types
export type CreditorType = 'TRADE' | 'OTHERS';

export interface RawRow {
  companyName: string;
  outletCode: string;
  documentCategory: DocumentCategory;
  documentType: string;
  documentDescription: string;
  invoiceNumber?: string;
  cnNumber?: string;
  date: string;
  debit?: number;
  credit?: number;
  vendorNameRaw: string;
  pageNumber: number;
  lineItemsCount?: number;
  confidence?: number;
  extractionRemarks?: string;
  fileName: string;
}

export interface EnrichedRow extends RawRow {
  vendorCode?: string;
  vendorNameMatched?: string;
  vendorMatchScore?: number;
  glCode?: string;
  glLabel?: string;
  glMatchMethod?: GLMatchMethod;
  status: TransactionStatus;
  reviewReason?: ReviewReason;
  reviewNotes?: string;
}

export interface ExportRow {
  outletCode: string;
  date: string;
  invoiceNumber: string;
  documentDescription: string;
  vendorCode: string;
  vendorNameMatched: string;
  glCode: string;
  glLabel: string;
  debit: number;
  credit: number;
  documentCategory: string;
}

export interface JobRecord {
  id: string;
  clientId: string;
  outletCode: string;
  fileUrl: string;
  originalFilename: string;
  status: JobStatus;
  totalRows: number;
  approvedRows: number;
  reviewRows: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ExtractionJobData {
  jobId: string;
  filePath: string;
  outletCode: string;
  originalFilename: string;
}

export interface EnrichmentJobData {
  jobId: string;
  clientId: string;
}
