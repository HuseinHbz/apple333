import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const buildDirectory = join(root, '.next');
const standaloneDirectory = join(buildDirectory, 'standalone');
const serverFile = join(standaloneDirectory, 'server.js');
const staticDirectory = join(buildDirectory, 'static');
const standaloneNextDirectory = join(standaloneDirectory, '.next');

if (!existsSync(serverFile)) {
  throw new Error('Standalone server artifact is missing. Run pnpm build before starting production.');
}

if (!existsSync(staticDirectory)) {
  throw new Error('Next static assets are missing. Run pnpm build before starting production.');
}

mkdirSync(standaloneNextDirectory, { recursive: true });
cpSync(staticDirectory, join(standaloneNextDirectory, 'static'), { recursive: true, force: true });

const publicDirectory = join(root, 'public');
if (existsSync(publicDirectory)) {
  cpSync(publicDirectory, join(standaloneDirectory, 'public'), { recursive: true, force: true });
}

console.log('Standalone runtime assets prepared.');
