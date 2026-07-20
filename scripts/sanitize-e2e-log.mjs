import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

export const E2E_LOG_PATH = resolve('logs/e2e/playwright-and-server.log');

const SENSITIVE_ENVIRONMENT_KEY = String.raw`(?:DATABASE_URL|REDIS_URL|[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASS|API_KEY|PRIVATE_KEY|COOKIE|AUTHORIZATION)[A-Z0-9_]*)`;

/**
 * Removes the credential-bearing forms that CI and application diagnostics
 * commonly emit. The workflow never persists the original stream: only this
 * transformed text is printed and uploaded.
 */
export function sanitizeE2eLog(value) {
  return value
    .replace(/\b(?:postgres(?:ql)?|redis|rediss):\/\/[^\s/@]+(?::[^\s/@]*)?@/gi, (match) => {
      const scheme = match.slice(0, match.indexOf('://') + 3);
      return `${scheme}[REDACTED]@`;
    })
    .replace(/\bhttps?:\/\/[^\s/@]+:[^\s/@]*@/gi, (match) => {
      const scheme = match.slice(0, match.indexOf('://') + 3);
      return `${scheme}[REDACTED]@`;
    })
    .replace(/\b(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/\b(cookie|set-cookie)\s*:\s*[^\r\n]+/gi, '$1: [REDACTED]')
    .replace(new RegExp(String.raw`\b(${SENSITIVE_ENVIRONMENT_KEY})\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)`, 'gi'), '$1=[REDACTED]')
    .replace(new RegExp(String.raw`(["']${SENSITIVE_ENVIRONMENT_KEY}["']\s*:\s*)"[^"]*"`, 'gi'), '$1"[REDACTED]"')
    .replace(new RegExp(String.raw`\b(${SENSITIVE_ENVIRONMENT_KEY})\s*:\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)`, 'gi'), '$1: [REDACTED]')
    .replace(/\b(--?(?:password|token|secret|api-key)=)[^\s]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:access_token|api_key|password|secret|token)=)[^&#\s]*/gi, '$1[REDACTED]');
}

async function main() {
  mkdirSync(dirname(E2E_LOG_PATH), { recursive: true });
  const output = createWriteStream(E2E_LOG_PATH, { encoding: 'utf8' });
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

  try {
    for await (const line of input) {
      const sanitizedLine = sanitizeE2eLog(line);
      output.write(`${sanitizedLine}\n`);
      process.stdout.write(`${sanitizedLine}\n`);
    }
  } finally {
    await new Promise((resolveOutput, rejectOutput) => {
      output.once('error', rejectOutput);
      output.end(resolveOutput);
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Could not sanitize the E2E diagnostic log.');
    process.exitCode = 1;
  });
}
