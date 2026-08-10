import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateScores,
  lighthouseArtifacts,
  lighthousePaths,
  LIGHTHOUSE_REPORT_ROOT,
  lighthouseReportRoots,
  validateLighthouseEnvironment,
} from '../../scripts/run-lighthouse.mjs';

const safeEnvironment = {
  LIGHTHOUSE_ALLOW_RUN: '1',
  LIGHTHOUSE_BASE_URL: 'http://127.0.0.1:3000',
  LIGHTHOUSE_RUN_ID: 'phase-051-local',
};

describe('Lighthouse runner safety and quality gate', () => {
  it('accepts a deliberate loopback run and creates the seven required route set', () => {
    const validation = validateLighthouseEnvironment(safeEnvironment);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(lighthousePaths(validation)).toEqual([
      { name: 'home', path: '/' },
      { name: 'products', path: '/products' },
      { name: 'product-detail', path: '/products/e2e-iphone-16-pro' },
      { name: 'category', path: '/categories/e2e-iphone' },
      { name: 'compare', path: '/compare' },
      { name: 'wishlist', path: '/wishlist' },
      { name: 'cart', path: '/cart' },
    ]);
  });

  it('writes JSON, standalone HTML, and a screenshot beneath the Phase 05.1.1 run directory', () => {
    const runDirectory = resolve(LIGHTHOUSE_REPORT_ROOT, 'staging-evidence-01');
    const stem = resolve(runDirectory, 'mobile-product-detail');
    const artifacts = lighthouseArtifacts({
      outputDirectory: runDirectory,
      mode: 'mobile',
      pageName: 'product-detail',
    });

    expect(artifacts).toEqual({
      stem,
      json: `${stem}.report.json`,
      html: `${stem}.report.html`,
      screenshot: `${stem}.screenshot.png`,
    });
  });

  it('selects the explicit Phase 05.1.2 evidence directory without accepting arbitrary roots', () => {
    const validation = validateLighthouseEnvironment({
      ...safeEnvironment,
      APPLE333_EVIDENCE_PHASE: '05.1.2',
    });

    expect(validation).toEqual(expect.objectContaining({
      ok: true,
      evidencePhase: '05.1.2',
      reportRoot: lighthouseReportRoots['05.1.2'],
    }));
    expect(validateLighthouseEnvironment({
      ...safeEnvironment,
      APPLE333_EVIDENCE_PHASE: 'untrusted-path',
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining(['APPLE333_EVIDENCE_PHASE must be one of 05.1.1 or 05.1.2.']),
    }));
  });

  it('rejects the production domain before Chrome can start', () => {
    expect(validateLighthouseEnvironment({
      ...safeEnvironment,
      LIGHTHOUSE_BASE_URL: 'https://apple333.ir',
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining(['LIGHTHOUSE_BASE_URL must never target the production domain.']),
    }));
  });

  it('enforces desktop SEO and accessibility thresholds', () => {
    const evaluated = evaluateScores('desktop', {
      categories: {
        performance: { score: 0.96 },
        accessibility: { score: 0.94 },
        'best-practices': { score: 0.99 },
        seo: { score: 0.99 },
      },
    });

    expect(evaluated.failures).toEqual([
      'seo=99 is below 100',
      'accessibility=94 is below 95',
    ]);
  });

  it('enforces mobile performance, SEO, and accessibility thresholds', () => {
    expect(evaluateScores('mobile', {
      categories: {
        performance: { score: 0.89 },
        seo: { score: 0.94 },
        accessibility: { score: 0.94 },
      },
    }).failures).toEqual([
      'performance=89 is below 90',
      'seo=94 is below 95',
      'accessibility=94 is below 95',
    ]);
  });
});
