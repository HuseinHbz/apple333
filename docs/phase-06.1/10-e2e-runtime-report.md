# Phase 06.1 - Playwright E2E Runtime Report

**Runtime status:** **EXECUTED / PASS**
**Production resources touched:** No.

## Final execution result

The guarded E2E wrapper verified the migrated test target, seeded the
controlled inventory fixtures, and ran the standalone application in
production mode.

```text
Playwright: 17 passed in 20.2s
```

The final run covers unauthenticated route protection, public product and
availability behaviour, IMEI non-disclosure/masking, authenticated inventory
views, branch and warehouse views, protected inventory API access, receipt,
adjustment, transfer, reservation/release, and protected device API output.

## Earlier failures and fixes retained in the record

The successful final result followed real failures; none were hidden or
converted into a passing result:

1. `CredentialsProvider` was incompatible with database sessions in this
   isolated E2E path. The runtime was corrected to use JWT sessions.
2. Browser assertions encountered non-unique selectors. The affected
   selectors were made explicit with `.first()` or a stable suffix.
3. Same-origin API requests received `403` because the internal origin did not
   match the trusted application origin. The trusted `APP_URL` configuration
   was corrected.

Each issue was rerun against the real disposable runtime. The final 17/17
result above is the post-fix evidence.

## Evidence boundary

No screenshot, video, trace, browser-console, or server-log claim is made here
beyond the captured successful test result. A future failure must retain its
diagnostic artifacts rather than be retried silently.

## Decision

The Phase 06.1 browser E2E gate passed on the isolated production-mode
runtime. It does not close the separate CI or dependency-security gates.
