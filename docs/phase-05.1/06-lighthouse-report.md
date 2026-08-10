# Phase 05.1 — Lighthouse Validation Report

**Status:** Not run; no Lighthouse score is claimed.
**Date:** 2026-07-20
**Scope:** Tooling and evidence review only. This module did not launch Chrome, start a server, write a Lighthouse report, deploy an environment, or access a database.

## 1. Decision

The required Lighthouse validation cannot yet be accepted. The expected output directory, docs/phase-05.1/lighthouse, contains no report artifact because there has been no valid Phase 05.1 run against a provisioned isolated target.

The current working tree includes guarded Lighthouse tooling and unit tests for its safety/threshold logic. They prove runner configuration, not Lighthouse page scores.

## 2. Required acceptance thresholds

| Mode | Performance | SEO | Accessibility | Best Practices | Current result |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop | >=95 | =100 | >=95 | >=95 | Not run |
| Mobile | >=90 | Not separately required by the Phase 05.1 brief | Not separately required by the Phase 05.1 brief | Not separately required by the Phase 05.1 brief | Not run |

The runner requests all four categories in both modes. The table preserves the Phase 05.1 acceptance criteria; it does not imply a passing mobile score for categories that have not been measured.

## 3. Required route matrix

| Page | Required path shape | Current desktop result | Current mobile result |
| --- | --- | --- | --- |
| Home | / | Not run | Not run |
| Catalog | /products | Not run | Not run |
| Product detail | /products/<seeded-product-slug> | Not run | Not run |
| Category | /categories/<seeded-category-slug> | Not run | Not run |

The runner defaults to synthetic slugs e2e-iphone-16-pro and e2e-iphone. A real run must provide slugs that exist in the isolated fixture. A route shell without seeded PIM data is not valid product/category performance evidence.

## 4. Existing runner safeguards

scripts/run-lighthouse.mjs is available in the current working tree. Its documented behavior is deliberately restrictive:

- requires LIGHTHOUSE_ALLOW_RUN=1;
- requires an absolute origin-only LIGHTHOUSE_BASE_URL and a valid run ID;
- refuses apple333.ir and www.apple333.ir before Chrome starts;
- permits loopback hosts, or exactly staging.apple333.ir when APPLE333_ENVIRONMENT=staging;
- allows only safe lowercase URL slugs for detail/category targets;
- uses Playwright Chromium, or an explicitly supplied executable;
- produces JSON for desktop and mobile home/catalog/detail/category pages;
- evaluates desktop performance, SEO, accessibility, and best-practices thresholds, plus the mobile performance threshold; and
- fails the process if a required score is missing or below threshold.

tests/unit/lighthouse-runner.test.ts validates the route matrix, production-domain rejection, desktop threshold evaluation, and mobile performance threshold logic. It does not execute Lighthouse against an application page.

## 5. Why no run was performed

| Blocker | Consequence |
| --- | --- |
| No evidenced isolated staging deployment | There is no approved non-production browser target for a production-like run. |
| Staging bootstrap is currently blocked by the Phase 04.1 release safeguard | Do not bypass the managed deployment/migration gate to obtain a score. |
| No completed Phase 05.1 10k/100k fixture run | Detail/category URLs and PIM-backed response behavior are not representative yet. |
| Full E2E environment has known Windows standalone-runtime and database configuration limitations | Browser readiness must be established on a supported host before a release-quality Lighthouse run. |
| No retained lighthouse JSON and summary artifacts | There is no raw result to inspect, reproduce, or approve. |

## 6. Safe future execution protocol

Run only after the isolated environment, synthetic fixture, and supported browser host have been evidenced. This is a future operator contract, not a command executed by this module.

1. Build and start the immutable SHA on the isolated target.
2. Verify readiness and use synthetic, existing product/category slugs.
3. Set APPLE333_ENVIRONMENT=staging for staging.apple333.ir, or use loopback.
4. Set LIGHTHOUSE_ALLOW_RUN=1, the approved base URL, a unique run ID, LIGHTHOUSE_PRODUCT_SLUG, and LIGHTHOUSE_CATEGORY_SLUG.
5. Run scripts/run-lighthouse.mjs with Playwright Chromium available.
6. Retain all JSON reports and summary.json under docs/phase-05.1/lighthouse/<run-id>.
7. Record source SHA, environment identity, host/Chrome versions, data run ID, cache condition, mode, and raw artifact paths in this report.

Before declaring a result, verify that every target returned PIM-backed published data rather than a fallback/error shell. A Lighthouse score from a failed or empty catalog route is not valid storefront evidence.

## 7. Required artifact schema

An accepted run must retain, at minimum:

- desktop-home.report.json
- desktop-products.report.json
- desktop-product-detail.report.json
- desktop-category.report.json
- mobile-home.report.json
- mobile-products.report.json
- mobile-product-detail.report.json
- mobile-category.report.json
- summary.json

They belong under docs/phase-05.1/lighthouse/<run-id>. The report update must identify source SHA, timestamp, non-production target identity, data fixture run ID, runtime versions, and each score. Raw JSON is the authority; Markdown tables are summaries only.

## 8. Current results

| Run ID | Target | Fixture | Desktop scores | Mobile performance | Artifact path | Result |
| --- | --- | --- | --- | --- | --- | --- |
| None | None | None | Not run | Not run | None | Not accepted |

## 9. Approval rule

Phase 05.1 remains unapproved until the complete route/mode matrix has raw, reproducible reports meeting the required thresholds. Do not substitute a passing build, runner unit test, screenshot, local route shell, or prior PIM database benchmark for a Lighthouse result.
