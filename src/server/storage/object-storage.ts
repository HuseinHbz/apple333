import 'server-only';

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export interface ObjectStorage {
  put(input: { key: string; contentType: string; body: Uint8Array }): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  signedReadUrl(key: string): Promise<string>;
}

function validateKey(key: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]{2,511}$/.test(key) || key.includes('..')) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  return key;
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly root = join(process.cwd(), '.local-media')) {}

  private pathFor(key: string): string {
    const safeKey = validateKey(key);
    const root = resolve(this.root);
    const target = resolve(root, safeKey);
    if (!target.startsWith(`${root}${sep}`)) {
      throw new Error('INVALID_STORAGE_KEY');
    }
    return target;
  }

  async put(input: { key: string; contentType: string; body: Uint8Array }): Promise<void> {
    const target = this.pathFor(input.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body, { flag: 'wx' });
  }

  async get(key: string): Promise<Uint8Array> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async signedReadUrl(key: string): Promise<string> {
    validateKey(key);
    return `/api/admin/media/content?key=${encodeURIComponent(key)}`;
  }
}

export class UnconfiguredStorage implements ObjectStorage {
  async put(): Promise<void> { throw new Error('STORAGE_NOT_CONFIGURED'); }
  async get(): Promise<Uint8Array> { throw new Error('STORAGE_NOT_CONFIGURED'); }
  async delete(): Promise<void> { throw new Error('STORAGE_NOT_CONFIGURED'); }
  async signedReadUrl(): Promise<string> { throw new Error('STORAGE_NOT_CONFIGURED'); }
}

export const objectStorage: ObjectStorage = process.env.NODE_ENV === 'production'
  ? new UnconfiguredStorage()
  : new LocalObjectStorage();
