# Apple333 server release gates

This file records deployment gates that are enforced by the reviewed scripts.
It is not an operator approval mechanism: editing a local copy, an environment
file, or a state file cannot authorize a blocked database operation.

## Current gates

| Gate | Status | Enforced by | Reason |
| --- | --- | --- | --- |
| Phase 04.1 PIM initial baseline (`20260713000000_phase_04_1_pim_activation`) | **BLOCKED** | `deploy/bin/lib.sh` | The migration is an add-only baseline only for pristine isolated test/CI PostgreSQL. It has no production, shared-database, legacy-adoption, or populated-schema authority. |

The block applies to both a fresh managed installation and
`update.sh --apply-migrations`. A normal code-only update remains subject to
its existing ownership preflight but does not attempt this migration.

## What a future reviewed release must contain

Before the current PIM gate can be changed, the later release must include all
of the following as reviewed source and release evidence:

1. a release-specific deployment decision that names the exact migration and
   target class; an operator-provided environment variable is insufficient;
2. a documented adoption plan for existing Apple333 data, or an explicit
   fresh-production initialization plan — never an inferred baseline;
3. read-only database identity, ownership, schema-fingerprint, and drift
   evidence for the exact target before any mutation;
4. reviewed migration SQL, lock/compatibility analysis, encrypted backup, and
   an isolated restore rehearsal; and
5. a rollback/recovery decision approved by the release authority.

Until then, use the Phase 04.1 disposable PIM environment only. Do not bypass
the guard, copy its migration into another script, use `db push`, or run a
manual destructive cleanup against a production or unknown database.
