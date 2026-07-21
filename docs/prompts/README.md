# Apple333 Enterprise Prompt Framework

This framework turns a future Apple333 phase request into a reviewable JSON
instruction contract before implementation begins. It is deliberately offline:
the validator reads only local JSON documents and never executes the commands
named in a prompt, contacts production, connects to a database, reads an
environment file, or changes repository files.

## Structure

| Path | Purpose |
| --- | --- |
| `schema/enterprise-phase-prompt.schema.json` | The versioned contract every phase prompt must satisfy. |
| `templates/` | Valid starting points for application, database, infrastructure, and security work. |
| `phases/` | Approved, phase-specific prompt instances created from a template. |
| `../../scripts/validate-enterprise-prompts.ts` | Offline AJV-based validator used by `pnpm prompt:validate`. |

## Create a phase prompt

1. Copy the closest template into `docs/prompts/phases/`, for example
   `docs/prompts/phases/phase-09-orders.json`.
2. Replace every generic statement with the approved phase objective, scope,
   paths, risk controls, acceptance criteria, and validation evidence.
3. Keep `constraints.productionAccess` false unless a separately approved
   production procedure exists. A JSON value is never an access authorization.
4. Set `constraints.databaseChanges` to `none` or `plan-only` unless a later,
   separately reviewed migration procedure has been approved. The framework does
   not authorize a database connection, migration, reset, `db push`, seed, or
   data change.
5. Give the prompt a valid branch name and explicit stop conditions, then run:

```bash
pnpm prompt:validate
# Or validate one drafted phase only:
pnpm prompt:validate docs/prompts/phases/phase-09-orders.json
```

The command fails for malformed JSON, unknown fields, missing safety controls,
or invalid values. It does not run `pnpm typecheck`, `pnpm lint`, migration, or
deployment commands listed inside the prompt; those are human-approved future
phase gates.

## Required phase execution sequence

Every future phase must use this sequence:

1. Draft a phase JSON from a template and validate it with
   `pnpm prompt:validate`.
2. Obtain human approval for scope, allowed paths, risk handling, validation
   plan, and any external authority needed.
3. Work only on the branch named in the approved prompt. Do not infer permission
   to touch forbidden paths, production, secrets, databases, or unrelated UI.
4. Implement the approved scope and run the required local quality commands.
5. Record the result, failed checks, residual risks, and follow-up work in the
   deliverable named by the prompt.
6. Do not commit, deploy, migrate, or contact production unless the phase
   request explicitly grants that authority and the relevant deployment/database
   safety policy is satisfied.

`destructiveOperations` is fixed to `false` by the schema. Any request that
would require destructive cleanup, rollback, credential access, schema
mutation, or production action is a stop condition until separately authorized.
