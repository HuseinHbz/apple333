# Phase 04 — Database Model

The authoritative migration-safety document is
[database-design.md](database-design.md).

The implementation uses the existing `Catalog*` aggregate as the PIM product
model and adds governed Brand, Warranty, SKU, normalized Specification, SEO,
and Import records around it. No database migration has been applied as part of
this document.
