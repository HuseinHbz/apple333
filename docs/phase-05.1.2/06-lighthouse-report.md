# Phase 05.1.2 — Module 06: Lighthouse execution report

**Status:** **BLOCKED — no verified isolated staging target was available**
**Review date:** 2026-07-20
**Production/staging deployment, database, and browser target access:** none

## Decision

No Lighthouse score is reported for this phase. The required staging URL has not
been provisioned or independently identified as isolated from production, and
this workstation has no Docker/PostgreSQL/Redis environment from which a
production-like seeded application can be started. Running Lighthouse against a
local database-error fallback would not be valid evidence.

## Evidence-ready tooling

`scripts/run-lighthouse.mjs` has a fail-closed target preflight:

- `LIGHTHOUSE_ALLOW_RUN=1` is required;
- production hosts `apple333.ir` and `www.apple333.ir` are rejected before
  Chromium starts;
- the only permitted remote target is the explicitly marked
  `staging.apple333.ir` when `APPLE333_ENVIRONMENT=staging`;
- all seven required routes are included: home, products, product detail,
  category, compare, wishlist, and cart;
- Desktop requires Performance >=95, SEO =100, Accessibility >=95, and Best
  Practices >=95;
- Mobile requires Performance >=90, SEO >=95, and Accessibility >=95;
- a closed `APPLE333_EVIDENCE_PHASE` selector permits only `05.1.1` or
  `05.1.2`; Phase 05.1.2 writes each route/mode JSON, standalone HTML, and
  full-page PNG beneath `docs/phase-05.1.2/lighthouse/<run-id>/`.

No Phase 05.1.2 artifact directory is created until a real run produces
evidence; creating empty or synthetic reports would be misleading.

The runner was deliberately not invoked with an opt-in or target. Its missing
environment preflight is expected and does not create a score.

## Required execution record

After an operator proves that the target is an isolated staging environment
with synthetic data and separate credentials, execute from the exact reviewed
commit:

```bash
export APPLE333_ENVIRONMENT=staging
export APPLE333_EVIDENCE_PHASE=05.1.2
export LIGHTHOUSE_ALLOW_RUN=1
export LIGHTHOUSE_BASE_URL=https://staging.apple333.ir
export LIGHTHOUSE_RUN_ID=phase-0512-<immutable-run-id>
export LIGHTHOUSE_PRODUCT_SLUG=<seeded-product-slug>
export LIGHTHOUSE_CATEGORY_SLUG=<seeded-category-slug>
node scripts/run-lighthouse.mjs
```

Record the immutable commit SHA, URL, timestamp, Chromium/Lighthouse versions,
seed identities (not customer data), all 14 JSON/HTML/screenshot triplets, and
`summary.json`. Reject the run if any score threshold fails, if the target
redirects to production, or if the data cannot be shown to be staging-only.

## Acceptance status

| Requirement | Result |
| --- | --- |
| Isolated staging target | Not available |
| Desktop seven-page scores | Not executed |
| Mobile seven-page scores | Not executed |
| JSON/HTML/screenshot artifacts | Not produced |
| Thresholds met | Not evaluated |

## Conclusion

Module 06 is **not approved**. No Lighthouse artifact or score is claimed.
