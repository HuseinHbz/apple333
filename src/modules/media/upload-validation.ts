import { randomUUID } from 'node:crypto';

import { createMediaInput, type CreateMediaInput } from '@/modules/media/validators';
import { ValidationError } from '@/server/errors/app-error';

const maxUploadBytes = 20 * 1024 * 1024;

type UploadPolicy = {
  contentType: string;
  extension: string;
  kind: CreateMediaInput['kind'];
  matchesMagic: (bytes: Uint8Array) => boolean;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function matchesWebp(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function matchesMp4(bytes: Uint8Array): boolean {
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

function matchesWebm(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
}

const policies: readonly UploadPolicy[] = [
  { contentType: 'image/jpeg', extension: 'jpg', kind: 'IMAGE', matchesMagic: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  { contentType: 'image/jpeg', extension: 'jpeg', kind: 'IMAGE', matchesMagic: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  { contentType: 'image/png', extension: 'png', kind: 'IMAGE', matchesMagic: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { contentType: 'image/webp', extension: 'webp', kind: 'IMAGE', matchesMagic: matchesWebp },
  { contentType: 'application/pdf', extension: 'pdf', kind: 'DOCUMENT', matchesMagic: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  { contentType: 'video/mp4', extension: 'mp4', kind: 'VIDEO', matchesMagic: matchesMp4 },
  { contentType: 'video/webm', extension: 'webm', kind: 'VIDEO', matchesMagic: matchesWebm }
];

function extensionFromName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  if (!extension || extension === name.toLowerCase()) {
    throw new ValidationError({ file: 'A permitted file extension is required.' });
  }
  return extension;
}

function looksExecutable(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) || startsWith(bytes, [0x23, 0x21]);
}

export type ValidatedUpload = {
  media: CreateMediaInput;
  body: Uint8Array;
};

export async function validateUploadedMedia(file: File): Promise<ValidatedUpload> {
  if (file.size <= 0 || file.size > maxUploadBytes) {
    throw new ValidationError({ file: 'File size must be between 1 byte and 20 MB.' });
  }

  const extension = extensionFromName(file.name);
  const policy = policies.find((candidate) => candidate.extension === extension && candidate.contentType === file.type);
  if (!policy) {
    throw new ValidationError({ file: 'This file type and extension are not allowed.' });
  }

  const body = new Uint8Array(await file.arrayBuffer());
  if (looksExecutable(body) || !policy.matchesMagic(body)) {
    throw new ValidationError({ file: 'File content does not match the allowed media type.' });
  }

  const storageKey = `media/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
  return {
    media: createMediaInput.parse({
      storageKey,
      originalName: file.name,
      contentType: file.type,
      extension,
      bytes: file.size,
      kind: policy.kind
    }),
    body
  };
}
