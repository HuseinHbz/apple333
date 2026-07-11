# Phase 03 — Admin UI Design System

## Design intent

The administration platform uses an **Apple Premium Enterprise** style: quiet,
high-contrast hierarchy, generous spacing, calm surfaces, and data-first
interactions. It is a work surface for sustained operational use, not a
marketing page. Visual polish must never obscure state, risk, or action
consequences.

This document defines the design contract. Component availability must be
verified in the codebase before it is described as implemented.

## Foundations

| Token family | Intended use |
| --- | --- |
| Surface | Distinguish page canvas, panel, raised panel, and destructive state without excessive borders |
| Text | Clear primary, secondary, muted, and inverse hierarchy with accessible contrast |
| Semantic status | Consistent success, warning, danger, info, and neutral meanings; never colour alone |
| Spacing | A small, repeatable scale for dense data views and comfortable forms |
| Radius and shadow | Restrained elevation that communicates hierarchy rather than decoration |
| Typography | Readable Persian/Latin pairing, tabular numerals for financial values, and stable line heights |

Token values should live in shared CSS/Tailwind configuration rather than be
duplicated per page. The UI must support both Persian content and technical
English identifiers without directionality leaks.

## Layout contract

- **Sidebar:** role-filtered navigation, current route indication, collapse
  behavior, accessible labels, and no security-sensitive data.
- **Header:** page context, breadcrumbs, notification affordance, actor menu,
  and responsive navigation trigger.
- **Page container:** predictable maximum width and vertical rhythm, with
  per-page title, description, actions, and content regions.
- **Footer:** optional, compact operational information only; it must not
  compete with critical controls.
- **Responsive behavior:** the shell remains usable at narrow widths, with
  tables offering a deliberate responsive representation rather than clipped
  columns.

## Component catalogue and interaction requirements

| Category | Components | Required behavior |
| --- | --- | --- |
| Data | Table, status badge, pagination, sort control, filter, search | Server-backed pagination; visible sort/filter state; keyboard operation; empty state |
| Forms | Input, select, date range, upload field, modal, confirmation dialog | Labels, error text, validation summary where needed, disabled/pending state, destructive confirmation |
| Feedback | Toast, alert, skeleton, error state, empty state | Announce meaningful state changes; preserve actionable retry paths |
| Navigation | Sidebar item, breadcrumb, tabs, page action menu | Visible focus, current-state indication, permission-filtered visibility only |
| Media | File tile/list, metadata panel, upload progress | Type/size status, non-preview fallback, safe name truncation |

Reusable components should expose semantic variants such as `success`,
`warning`, `danger`, and `neutral`, rather than page-specific colour classes.

## Current implementation evidence

The shared admin component set now includes responsive shell/navigation,
data table, server-aware pagination for users and audit records, search/filter
controls, badges, input/select/date inputs, file picker, Radix modal and
confirmation dialog, alert, toast, skeleton, and empty/error states. Role and
settings forms use pending/error states and audit-sensitive confirmations.

Column sorting is deliberately not claimed as completed: the current lists
support documented server ordering plus search/filter/pagination, while an
explicit user-selectable sort contract remains a follow-up before production
sign-off.

## Data-dense screens

User, role, permission, media, notification, and audit screens should share a
common list pattern:

1. Page title, description, and permission-gated primary action.
2. Search and filters with a clear reset operation.
3. Table/list with explicit column labels and row actions.
4. Loading skeleton, zero-result state, and failure state.
5. Pagination with current range and total only when the backend supplies a
   trustworthy count.

Do not show illustrative business metrics as if they are operational facts.

## Accessibility and localization

- Meet WCAG 2.2 AA contrast and keyboard-operability expectations.
- Use semantic landmarks, native button/link semantics, and form labels.
- Preserve focus when dialogs open/close and when a mutation completes.
- Pair icons with text or accessible labels; tooltips are supplementary.
- Support RTL layout intentionally; numeric, date, and identifier fields need
  a tested directionality policy.
- Format dates, currency, and numbers at the presentation boundary rather than
  storing localized strings.

## UX safety rules

- Destructive actions require a confirmation dialog describing the effect.
- Critical system roles and irreversible settings must explain why an action is
  unavailable.
- Permission errors must not leak records or internal policy details.
- Optimistic UI updates are appropriate only when a safe rollback and clear
  server error state exist.
- Loading UI must not impersonate a successful result.

## Visual QA expectations

Visual review should cover desktop and narrow viewport shell behavior, keyboard
navigation, RTL content, long identifiers, empty/error/loading states, and
destructive-action dialogs. Screenshots are evidence of a review, not a
substitute for functional E2E coverage.
