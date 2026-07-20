import { execFile as execFileCallback } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { chromium } from '@playwright/test';

const execFile = promisify(execFileCallback);
export const LIGHTHOUSE_REPORT_ROOT = resolve('docs/phase-05.1.1/lighthouse');
export const lighthouseReportRoots = Object.freeze({
  '05.1.1': LIGHTHOUSE_REPORT_ROOT,
  '05.1.2': resolve('docs/phase-05.1.2/lighthouse'),
});
const LOCAL_LIGHTHOUSE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const PRODUCTION_HOSTS = new Set(['apple333.ir', 'www.apple333.ir']);
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const lighthouseThresholds = Object.freeze({
  desktop: Object.freeze({ performance: 0.95, seo: 1, accessibility: 0.95, 'best-practices': 0.95 }),
  mobile: Object.freeze({ performance: 0.9, seo: 0.95, accessibility: 0.95 }),
});

const screenshotContexts = Object.freeze({
  desktop: Object.freeze({
    viewport: Object.freeze({ width: 1440, height: 900 }),
    deviceScaleFactor: 1,
  }),
  mobile: Object.freeze({
    viewport: Object.freeze({ width: 390, height: 844 }),
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  }),
});

/**
 * This runner rejects production and unqualified remote targets before it
 * launches Chrome. It has no credential handling and never deploys anything.
 */
export function validateLighthouseEnvironment(environment = process.env) {
  const errors = [];
  if (environment.LIGHTHOUSE_ALLOW_RUN !== '1') {
    errors.push('LIGHTHOUSE_ALLOW_RUN must be exactly "1".');
  }

  const rawBaseUrl = environment.LIGHTHOUSE_BASE_URL;
  if (!rawBaseUrl) {
    errors.push('LIGHTHOUSE_BASE_URL is required.');
    return { ok: false, errors };
  }

  let baseUrl;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    errors.push('LIGHTHOUSE_BASE_URL must be a valid absolute URL.');
    return { ok: false, errors };
  }

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    errors.push('LIGHTHOUSE_BASE_URL must use http or https.');
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || baseUrl.pathname !== '/') {
    errors.push('LIGHTHOUSE_BASE_URL must be an origin without credentials, path, query, or fragment.');
  }
  if (PRODUCTION_HOSTS.has(baseUrl.hostname)) {
    errors.push('LIGHTHOUSE_BASE_URL must never target the production domain.');
  }
  const isLocal = LOCAL_LIGHTHOUSE_HOSTS.has(baseUrl.hostname);
  const isApprovedStaging = environment.APPLE333_ENVIRONMENT === 'staging' && baseUrl.hostname === 'staging.apple333.ir';
  if (!isLocal && !isApprovedStaging) {
    errors.push('LIGHTHOUSE_BASE_URL must use localhost or the explicitly marked staging host.');
  }

  const runId = environment.LIGHTHOUSE_RUN_ID;
  if (!runId || !RUN_ID_PATTERN.test(runId)) {
    errors.push('LIGHTHOUSE_RUN_ID must be 3-64 lowercase letters, digits, or hyphens.');
  }
  const productSlug = environment.LIGHTHOUSE_PRODUCT_SLUG ?? 'e2e-iphone-16-pro';
  const categorySlug = environment.LIGHTHOUSE_CATEGORY_SLUG ?? 'e2e-iphone';
  if (!SLUG_PATTERN.test(productSlug) || !SLUG_PATTERN.test(categorySlug)) {
    errors.push('LIGHTHOUSE_PRODUCT_SLUG and LIGHTHOUSE_CATEGORY_SLUG must be lowercase URL slugs.');
  }
  const evidencePhase = environment.APPLE333_EVIDENCE_PHASE ?? '05.1.1';
  const reportRoot = lighthouseReportRoots[evidencePhase];
  if (!reportRoot) {
    errors.push('APPLE333_EVIDENCE_PHASE must be one of 05.1.1 or 05.1.2.');
  }

  return {
    ok: errors.length === 0,
    errors,
    ...(errors.length === 0 ? { baseUrl, runId, productSlug, categorySlug, evidencePhase, reportRoot } : {}),
  };
}

export function lighthousePaths({ productSlug, categorySlug }) {
  return [
    { name: 'home', path: '/' },
    { name: 'products', path: '/products' },
    { name: 'product-detail', path: `/products/${encodeURIComponent(productSlug)}` },
    { name: 'category', path: `/categories/${encodeURIComponent(categorySlug)}` },
    { name: 'compare', path: '/compare' },
    { name: 'wishlist', path: '/wishlist' },
    { name: 'cart', path: '/cart' },
  ];
}

export function lighthouseArtifacts({ outputDirectory, mode, pageName }) {
  const stem = resolve(outputDirectory, `${mode}-${pageName}`);
  return Object.freeze({
    stem,
    json: `${stem}.report.json`,
    html: `${stem}.report.html`,
    screenshot: `${stem}.screenshot.png`,
  });
}

function scoreOf(report, category) {
  const score = report?.categories?.[category]?.score;
  return typeof score === 'number' ? score : null;
}

export function evaluateScores(mode, report) {
  const thresholds = lighthouseThresholds[mode];
  const scores = Object.fromEntries(Object.keys(thresholds).map((category) => [category, scoreOf(report, category)]));
  const failures = Object.entries(thresholds).flatMap(([category, threshold]) => {
    const score = scores[category];
    return score === null || score < threshold
      ? [`${category}=${score === null ? 'missing' : Math.round(score * 100)} is below ${Math.round(threshold * 100)}`]
      : [];
  });
  return { scores, thresholds, failures };
}

function chromePath(environment) {
  const candidate = environment.LIGHTHOUSE_CHROME_PATH ?? chromium.executablePath();
  if (!candidate || !existsSync(candidate)) {
    throw new Error('No Chromium executable is available. Install Playwright Chromium or set LIGHTHOUSE_CHROME_PATH.');
  }
  return candidate;
}

async function runLighthouse({ targetUrl, mode, artifacts, executablePath }) {
  const lighthouseCli = resolve('node_modules/lighthouse/cli/index.js');
  const argumentsList = [
    lighthouseCli,
    targetUrl.toString(),
    '--output=json',
    '--output=html',
    `--output-path=${artifacts.stem}`,
    `--chrome-path=${executablePath}`,
    '--chrome-flags=--headless=new --no-sandbox',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--quiet',
  ];
  if (mode === 'desktop') argumentsList.push('--preset=desktop');

  await execFile(process.execPath, argumentsList, {
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    maxBuffer: 1024 * 1024,
  });

  const missingReports = [artifacts.json, artifacts.html].filter((path) => !existsSync(path));
  if (missingReports.length > 0) {
    throw new Error(`Lighthouse did not write required reports: ${missingReports.join(', ')}`);
  }
  return JSON.parse(readFileSync(artifacts.json, 'utf8'));
}

async function captureScreenshot({ targetUrl, mode, outputPath, executablePath }) {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext(screenshotContexts[mode]);
    try {
      const page = await context.newPage();
      await page.goto(targetUrl.toString(), { waitUntil: 'networkidle', timeout: 60_000 });
      await page.screenshot({ path: outputPath, fullPage: true });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  if (!existsSync(outputPath)) {
    throw new Error(`Lighthouse screenshot was not written: ${outputPath}`);
  }
}

async function main() {
  const validation = validateLighthouseEnvironment();
  if (!validation.ok) {
    throw new Error(`Lighthouse preflight failed: ${validation.errors.join(' ')}`);
  }

  const { baseUrl, runId, productSlug, categorySlug, reportRoot } = validation;
  const outputDirectory = resolve(reportRoot, runId);
  mkdirSync(outputDirectory, { recursive: true });
  const executablePath = chromePath(process.env);
  const entries = [];
  const violations = [];

  for (const mode of ['desktop', 'mobile']) {
    for (const page of lighthousePaths({ productSlug, categorySlug })) {
      const targetUrl = new URL(page.path, baseUrl);
      const artifacts = lighthouseArtifacts({ outputDirectory, mode, pageName: page.name });
      const report = await runLighthouse({ targetUrl, mode, artifacts, executablePath });
      await captureScreenshot({
        targetUrl,
        mode,
        outputPath: artifacts.screenshot,
        executablePath,
      });
      const evaluation = evaluateScores(mode, report);
      entries.push({
        mode,
        page: page.name,
        url: targetUrl.toString(),
        reports: { json: artifacts.json, html: artifacts.html },
        screenshot: artifacts.screenshot,
        ...evaluation,
      });
      violations.push(...evaluation.failures.map((failure) => `${mode}:${page.name}:${failure}`));
    }
  }

  const summaryPath = resolve(outputDirectory, 'summary.json');
  writeFileSync(summaryPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    target: baseUrl.toString(),
    runId,
    entries,
  }, null, 2)}\n`, 'utf8');
  console.log(`Lighthouse reports written to ${outputDirectory}.`);
  if (violations.length > 0) {
    throw new Error(`Lighthouse quality gate failed: ${violations.join(' | ')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Lighthouse validation failed.');
    process.exitCode = 1;
  });
}
