# Order Integration

Payment creation loads the persisted Order and copies only its immutable
`grandTotalRials` and `currency`. Cancelled/rejected Orders and already-paid
Orders reject new initialization according to policy.

After provider verification, one serializable transaction:

1. locks and validates Payment/attempt/Order state;
2. appends the verification/capture transaction;
3. changes Payment to `PAID` with optimistic versioning;
4. changes `Order.paymentStatus` to `PAID` without accepting a browser amount;
5. writes Payment audit/outbox `payment.paid`;
6. writes Order outbox `order.payment_completed` without merging aggregate
   ownership;
7. completes the Order only when the existing OMS fulfillment rule permits it.

Payment failure does not silently cancel an Order. Refund state does not erase
the historical `PAID` transaction. Legacy manual Order payment recording is
removed from UI and fails closed once canonical Payment orchestration is active.
