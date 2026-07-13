# Phase 04.1 — rollback and recovery plan

## Baseline migration boundary

The Phase 04.1 migration is an initial, add-only schema baseline. It has no
automatic down migration and must only be applied to a new disposable test or
CI database. This intentionally avoids unsafe reverse DDL and prevents a
rollback process from deleting data automatically.

## Failure scenarios

| Scenario | Safe response |
| --- | --- |
| Guard rejects environment/URL | Stop. Correct the test-only configuration; do not bypass the guard. |
| Migration SQL review fails | Stop before `migrate deploy`, revise the migration, and repeat the review. |
| `migrate deploy` fails on isolated DB | Preserve logs and `migrate status`; do not reset or force the migration. Recreate only the disposable environment through an operator-approved test-environment lifecycle. |
| Database integration test fails | Do not retry on a shared database. Preserve evidence, fix code/migration, and repeat on a fresh isolated target. |
| Import application fails | The business transaction must roll back data changes; the batch is recorded as failed with a safe error code for review. |
| Worker stops after claiming an import | Wait for the 30-minute apply lease to expire, then let one guarded retry reclaim the token. The original business transaction either committed `COMPLETED` atomically or rolled back; do not edit rows manually. |
| Legacy/shared database discovered | Stop immediately. Create a separate discovery, backup, drift, locking, and backfill plan. |

## Recovery procedure

1. Freeze deployment of the affected commit.
2. Collect migration name, Prisma status, database identity output, application
   logs, and CI artifacts without exposing credentials.
3. Confirm whether the target is the disposable Phase 04.1 environment. If it
   is not, escalate to the database owner and perform no automated action.
4. For a disposable target only, rebuild it using the documented isolated
   environment after explicit operator approval. No application script is
   allowed to drop, truncate, or reset it automatically.
5. Re-run guard, migration review, `migrate deploy`, status, and database
   integration tests before reopening the release gate.

## Production position

No Phase 04.1 migration has been approved for production or a shared existing
database. The deploy scripts explicitly block the named baseline unless a
later reviewed release provides a per-command acknowledgement. Therefore the
safe production rollback at this stage is to avoid applying the baseline rather
than attempting destructive reversal.
