# Refund and Reconciliation Foundation

Refunds require `payments.refund`, a positive integer-rial amount, a bounded
reason, and an idempotency key. The sum of pending/successful refunds may not
exceed the captured Payment amount. This phase records orchestration evidence
only; it creates no accounting or general-ledger entries.

`pnpm payment:reconcile` is read-only by default. It compares internal and
simulator/provider state for:

- internal PAID/provider not paid;
- provider paid/internal not PAID;
- amount or currency mismatch;
- duplicate provider reference;
- provider success without an Order;
- refund mismatch;
- unprocessed callback.

Each check writes a `PaymentReconciliationRecord` only when explicitly executed
in the guarded test environment or authorized admin operation. No automatic
repair is performed. Deterministic test acceptance is zero unexplained drift.
