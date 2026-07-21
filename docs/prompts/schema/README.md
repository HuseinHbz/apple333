# Enterprise phase prompt schema

`enterprise-phase-prompt.schema.json` uses JSON Schema Draft 2020-12 and is
validated with AJV 8. The schema is intentionally strict:

- unknown top-level or nested fields fail validation;
- every phase must state a bounded scope, forbidden paths, non-goals, risks,
  validation commands, deliverables, acceptance criteria, branch, and stop
  conditions;
- every phase must state database and production-access intent explicitly;
- destructive operations are always disallowed by this framework; and
- human approval is required before phase execution.

## Contract overview

| Field | Purpose |
| --- | --- |
| `phase` | Stable ID, numeric roadmap reference, name, and phase category. |
| `scope` | Explicit in-scope/out-of-scope behavior and permitted/forbidden paths. |
| `constraints` | Production, database, secret, destructive-operation, and commit boundaries. |
| `architecture` | Decisions and external/internal dependencies that inform the work. |
| `implementation` | Ordered work steps and declared non-goals. |
| `validation` | Commands to run later, manual evidence, and prohibited commands. |
| `deliverables` | Required documentation, source, test, configuration, or report outputs. |
| `risks` | Severity, description, and mitigation for every material risk. |
| `acceptanceCriteria` | Testable statements used for phase sign-off. |
| `execution` | Approved branch, work mode, human approval requirement, and stop conditions. |

The `schema` property in each document must equal this schema’s stable `$id`,
and `schemaVersion` must be `1.0`. Update both deliberately when introducing a
breaking framework revision; do not silently loosen an existing contract.

## Validator behavior

Run from repository root:

```bash
pnpm prompt:validate
```

With no arguments, the validator recursively checks JSON files under
`docs/prompts/templates/` and `docs/prompts/phases/`. Passing one or more
repository-relative file/directory paths narrows the check:

```bash
pnpm prompt:validate docs/prompts/phases/phase-09-orders.json
```

The validator is a local filesystem operation only. It never evaluates prompt
text as shell code and does not execute any `validation.commands` entries.
