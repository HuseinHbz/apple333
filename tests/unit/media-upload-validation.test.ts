import { describe, expect, it } from 'vitest';

import { validateUploadedMedia } from '@/modules/media/upload-validation';

function testFile(bytes: number[], name: string, type: string): File {
  const payload = new Uint8Array(bytes);
  const file = new File([payload], name, { type }) as File & { arrayBuffer: () => Promise<ArrayBuffer> };
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => payload.buffer.slice(0)
  });
  return file;
}

describe('media upload validation', () => {
  it('accepts an allowed PDF with matching magic bytes', async () => {
    const file = testFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], 'guide.pdf', 'application/pdf');
    const validated = await validateUploadedMedia(file);

    expect(validated.media.kind).toBe('DOCUMENT');
    expect(validated.media.storageKey).toMatch(/^media\//);
  });

  it('rejects an executable masquerading as an image', async () => {
    const file = testFile([0x4d, 0x5a, 0x90, 0x00], 'photo.jpg', 'image/jpeg');
    await expect(validateUploadedMedia(file)).rejects.toThrow();
  });
});
