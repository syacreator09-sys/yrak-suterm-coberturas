export const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm',
  'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function validateEvidence(input: { mimeType: string; byteSize: number }, maximumBytes = 20 * 1024 * 1024): void {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(input.mimeType)) throw new Error('UNSUPPORTED_EVIDENCE_TYPE');
  if (input.byteSize <= 0 || input.byteSize > maximumBytes) throw new Error('INVALID_EVIDENCE_SIZE');
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export class EvidenceStore {
  constructor(private readonly bucket: R2Bucket) {}
  async put(key: string, bytes: ArrayBuffer, mimeType: string, sha256: string): Promise<void> {
    await this.bucket.put(key, bytes, { httpMetadata: { contentType: mimeType }, customMetadata: { sha256 } });
  }
}
