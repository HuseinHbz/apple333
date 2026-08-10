# Phase 08 Performance Report

## Method

The guarded benchmark inserts deterministic Orders, Payments, and Attempts into
the disposable PostgreSQL target, performs 50 samples per internal operation,
and reports p95. It does not call a gateway; external network latency is
explicitly excluded and cannot be attributed to the application.

## Results

| Internal operation          | Target p95 |  10k p95 | 100k p95 | Result |
| --------------------------- | ---------: | -------: | -------: | ------ |
| Payment lookup              |     150 ms | 1.207 ms | 1.352 ms | Pass   |
| Admin payment list          |     250 ms | 1.273 ms | 1.433 ms | Pass   |
| Initialization lookup/guard |     300 ms | 1.043 ms | 1.015 ms | Pass   |
| Callback authority lookup   |     300 ms | 1.106 ms | 1.023 ms | Pass   |
| Reconciliation lookup       |     250 ms | 1.689 ms | 1.727 ms | Pass   |

The 10k and 100k datasets each contained equal numbers of Orders, Payments, and
PaymentAttempts. After the final datasets, reconciliation inspected 220,045
total Payments and found zero mismatch.

## Interpretation and limitations

These figures prove index and query behavior on the local disposable evidence
host; they are not a production capacity claim. Provider latency, TLS, edge
rate limiting, geographic network delay, external sandbox throttling, and
production hardware are not included. GitHub Actions repeats each dataset and
retains its JSON artifact for independent review.
