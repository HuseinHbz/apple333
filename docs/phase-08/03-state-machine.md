# Payment State Machine

Allowed canonical transitions are:

```text
CREATED -> INITIALIZING -> PENDING -> AUTHORIZED -> PAID
   |            |            |            |
   +------------+------------+------------+-> FAILED
                |            +--------------> EXPIRED
                +---------------------------> CANCELLED
PAID -> PARTIALLY_REFUNDED -> REFUNDED
PAID -----------------------> REFUNDED
```

Rules:

1. Only the Payment domain service changes canonical status.
2. Every change uses `expectedVersion`, increments the version, writes audit
   evidence and a Payment outbox event in the same transaction.
3. `PAID` requires a successful provider verification with exact authority,
   amount, currency, and canonical provider state.
4. Redirect/query parameters never mark a Payment paid.
5. Duplicate success callbacks replay the original result and cannot add a
   second capture/verification transaction.
6. `PAID` is terminal except refund transitions. Failed or expired attempts may
   be retried by a new attempt when order policy permits.
7. Invalid or stale transitions fail closed with no partial state change.
