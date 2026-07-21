# Phase 05.1 - Storefront accessibility report

**Status:** Partially validated; not approved as a complete WCAG 2.2 result.
**Date:** 2026-07-20
**Scope:** Local automated checks and source review only. No production system, staging system, database, or customer data was accessed.

## 1. Decision

The Phase 05.1 storefront now has an automated axe suite and several real local
passing checks. That is useful evidence, but it is not a full accessibility
approval: the catalog and product-detail checks need a healthy, seeded PIM
environment, and automated axe coverage does not replace manual keyboard or
assistive-technology testing.

## 2. Automated evidence collected

`@axe-core/playwright` is used with the WCAG tags `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`, and `wcag22aa`. The test attaches raw axe violation JSON
to Playwright results when it runs.

| Local check | Result | Interpretation |
| --- | --- | --- |
| Home axe check | Pass | The rendered local home shell had no violations for the selected axe WCAG A/AA rules. |
| Comparison axe check | Pass, limited | The route rendered while the local PIM database was absent; it is not valid comparison-data acceptance evidence. |
| Wishlist axe check | Pass | The local guest-wishlist shell had no selected axe violations. |
| Cart axe check | Pass | The local cart shell had no selected axe violations. |
| Mobile navigation interaction | Pass | At 390px wide, the menu control exposed its controlled navigation, updated `aria-expanded`, and closed with Escape. |
| Full seeded axe matrix | Not run | Catalog search and product detail require the disposable test database plus fixture. |

The current E2E listing contains six axe page checks plus the mobile-navigation
semantic interaction. A complete all-route result has not been claimed.

## 3. Real issue found and corrected

An early local axe result found a serious `color-contrast` violation in the
home-page tracking labels. `text-zinc-500` on the `#f6f6f4` background measured
approximately 4.46:1, below the 4.5:1 requirement for normal text. The affected
home labels included `CATALOG`, `NEW`, and `OFFERS`.

The affected tracking-label treatment was changed to `text-zinc-600` in the
storefront headings and matching storefront sections. The home axe check then
passed. This correction is evidence for that rendered local surface only; it
does not prove every possible PIM-provided value, media state, breakpoint, or
browser combination.

The full local E2E attempt also exposed a serious `document-title` violation
when a product route reached the Server Components error boundary without a
database. The error boundary now sets `خطایی رخ داد | Apple333`; the global error
document has a title and the not-found route now has explicit metadata. The
targeted product-detail axe check passed after this correction. This validates
the error-page title, not a healthy PIM-backed product detail.

## 4. Accessibility improvements in this phase

| Area | Current behavior | Evidence / limitation |
| --- | --- | --- |
| Skip navigation | The existing storefront shell exposes a keyboard skip link to `#storefront-content`. | Existing E2E covers its presence; full keyboard journey still needs seeded route testing. |
| Mobile navigation | The former mobile menu link is now a real button with `aria-controls`, `aria-expanded`, an accessible name, a controlled navigation region, link-close behavior, and Escape handling. | Local interaction test passes at a mobile viewport. Screen-reader announcements have not been tested manually. |
| Contrast | Low-contrast tracking labels were strengthened after an actual axe finding. | Remaining data-dependent pages need seeded axe runs. |
| Product selection | The comparison action is disabled until at least two products are selected. | Reduces a no-op control path; not a substitute for full keyboard flow testing. |
| Forms and state | Existing catalog controls use labels, cart controls use native buttons, and visible loading/error states remain exposed in the UI. | Requires keyboard, focus-order, error-recovery, and screen-reader checks with real catalog data. |

## 5. Known validation gaps

1. No full axe run has passed against seeded product, catalog-search, category,
   comparison, wishlist, and cart data in one disposable environment.
2. No manual NVDA/JAWS/VoiceOver or TalkBack test has been performed.
3. Focus order, focus-visible styling, focus restoration after every dialog or
   async action, zoom/reflow at 200-400%, forced-colors mode, and reduced-motion
   behavior have not been independently recorded.
4. Persian-language pronunciation, bidirectional reading order, localized
   accessible names, and product/media alt-text quality require manual review
   against actual PIM content.
5. axe rule coverage is not an exhaustive proof of WCAG 2.2 conformance.

## 6. Required acceptance run

On the isolated disposable database only:

1. Migrate and seed the deterministic E2E fixture; do not use production or
   staging data.
2. Run all storefront axe checks at desktop and mobile widths with published
   product, category, price, image, comparison, wishlist, and cart data.
3. Preserve Playwright HTML output and attached axe JSON for every route.
4. Manually test keyboard-only flows, browser zoom/reflow, Persian RTL reading,
   and at least one screen reader/browser combination.
5. Treat any serious/critical axe violation or broken keyboard path as a release
   blocker until a focused fix and re-run pass.

## 7. Conclusion

The locally testable accessibility surfaces have improved and the discovered
contrast defect is corrected. The missing seeded, cross-route, and manual
evidence means the Phase 05.1 accessibility target is **not approved**.
