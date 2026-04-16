import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), '..', '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function saveUploadedFile(file: any): Promise<{ jobId: string; filePath: string }> {
  const jobId = randomUUID();
  const filePath = path.join(UPLOAD_DIR, `${jobId}.pdf`);
  await pipeline(file.file, fs.createWriteStream(filePath));
  return { jobId, filePath };
}

export function getFilePath(jobId: string): string {
  return path.join(UPLOAD_DIR, `${jobId}.pdf`);
}

export function deleteUploadedFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[FileStorage] Could not delete file ${filePath}:`, (err as Error).message);
  }
}