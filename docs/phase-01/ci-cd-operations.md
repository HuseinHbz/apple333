# Phase 01 CI/CD operations runbook

## Status and boundary

This document explains the operator configuration required by the repository's
workflow definitions. It does **not** assert that GitHub Environments, branch
rules, self-hosted runners, server checkouts, protected environment files, or
deployment approvals already exist.

The workflows are intentionally separated:

| Workflow | Trigger and intent | Production authority |
| --- | --- | --- |
| `quality.yml` | Pull requests, branch pushes, and manual runs; installs, validates Prisma, type-checks, lints, tests, builds, and runs browser smoke checks. | None. |
| `security.yml` | Pull requests, release-branch pushes, scheduled/manual scans. | None. |
| `deploy-staging.yml` | A successful trusted `Quality` push run from `main`/`master`, or a manual dispatch that proves that same SHA passed Quality. | Staging only. |
| `deploy-production.yml` | Manual dispatch from a protected `main`/`master` branch with exact confirmation and a successful Quality run for the same SHA. | Requires the GitHub `production` Environment approval gate. |

Do not add production deployment to a push, pull-request, schedule, or
`workflow_run` trigger. Do not place production secrets in workflow YAML,
repository variables, job logs, issues, or chat.

## GitHub repository setup

Before enabling a deployment, a repository administrator must complete and
record these steps:

1. Protect the release branch (`main` or `master`): require reviewed pull
   requests, required `Quality` and `Security` checks, and restrict direct
   pushes according to the organization policy.
2. Create the `staging` and `production` GitHub Environments. Configure
   required reviewers for `production`; use deployment-branch restrictions so
   only the protected release branch can request production.
3. Give only the designated release operators permission to run workflow
   dispatches and approve the production Environment. Review audit logs for
   each approval.
4. Configure the repository variables below. They are paths, labels, and
   health URLs—not secrets. Keep all passwords, tokens, database URLs, age
   identities, and authentication values solely in the protected server
   environment file or an approved secret manager.

| Environment | Repository variable | Required value |
| --- | --- | --- |
| Staging | `STAGING_RUNNER_LABEL` | A unique label applied only to the staging deployment runner. |
| Staging | `STAGING_DEPLOY_PATH` | Absolute path to the dedicated existing Git checkout on the staging runner. |
| Staging | `STAGING_ENV_FILE` | Absolute path to the protected environment file outside that checkout. |
| Staging | `STAGING_HEALTHCHECK_URL` | Approved public staging readiness URL, beginning with `https://` where TLS is enabled. |
| Production | `PRODUCTION_RUNNER_LABEL` | A unique label applied only to the production deployment runner. |
| Production | `PRODUCTION_DEPLOY_PATH` | Absolute path to the dedicated existing Git checkout on the production runner. |
| Production | `PRODUCTION_ENV_FILE` | Absolute path to the protected environment file outside that checkout. |
| Production | `PRODUCTION_HEALTHCHECK_URL` | Approved public production readiness URL, beginning with `https://`. |

Use distinct runner labels, checkouts, environment files, Compose projects,
databases/schemas, volumes, state directories, backup destinations, and public
hostnames for staging and production. A staging runner must never point to a
production environment file or Docker context.

## Self-hosted runner and server contract

The deployment job does not provision a server. Before registering a runner,
the infrastructure owner must verify:

- Linux `x64` runner with the `self-hosted`, `linux`, `x64`, and environment
  label expected by the workflow;
- Docker Engine and Docker Compose v2 available only to the reviewed deployment
  account, plus `bash`, `curl`, `age`, `openssl`, `flock`, and `realpath`;
- a dedicated absolute Git checkout whose top level is exactly the configured
  `*_DEPLOY_PATH`, with a read-only repository credential capable of fetching
  the exact approved commit;
- a clean checkout before every job—workflows intentionally refuse tracked,
  staged, or untracked changes;
- an external protected `*_ENV_FILE`, mode `0600`, readable by the deployment
  account, with `APPLE333_INSTALL_ROOT` matching the checkout and an identity
  unique to that environment;
- a network path only to the target Docker daemon, approved TLS endpoint, and
  required backup destination; and
- runner registration, host patching, log retention, and removal procedures
  owned by the infrastructure team.

Do not use a general developer workstation, shared build runner, or a runner
that has broad access to another production environment. The workflow checks
only some of these conditions; host isolation remains an operator control.

## Initial staged setup procedure

1. Complete the repository and runner contract above without storing secrets in
   GitHub variables.
2. On the target server, use the managed deployment guide to create and review
   the protected environment file and run a read-only preflight. The server
   must have a reviewed baseline Prisma migration before first installation can
   proceed.
3. Validate the target manually on staging, including ownership, Docker Compose
   behavior, external TLS, health/readiness, monitoring, encrypted backup, and
   isolated restore evidence. Do not use CI to bypass an unproven first install.
4. Run the staging workflow for the exact release branch/commit. Select
   migration mode `apply` only after migration SQL, backup compatibility, and
   rollback are approved; otherwise select `skip` only when schema
   compatibility is documented.
5. Attach the workflow URL, commit SHA, preflight result, migration decision,
   health output, and rollback reference to the release record.

The staging workflow fetches and checks out the exact commit SHA in the
pre-provisioned checkout, runs ownership-aware preflight/update commands, and
then calls the configured public health URL. It is not a replacement for the
operator's first-install, TLS, backup, or incident-recovery review.

## Production release procedure

1. Start only from the protected release branch after required quality/security
   checks and staging evidence are attached.
2. Confirm the target checkout is clean, its protected external environment
   file still belongs to the intended production identity, and the database
   migration decision is documented.
3. Manually dispatch **Deploy production (manual)**, select the reviewed
   migration mode, and type the workflow's exact confirmation phrase.
4. A designated GitHub Environment reviewer must approve the `production`
   deployment. Do not approve a release whose commit, target identity,
   migration decision, or backup evidence is unclear.
5. Record the production workflow URL, approver, commit SHA, preflight result,
   migration decision, backup ID where applicable, public readiness result,
   monitoring observation window, and rollback owner.

If a production workflow fails, preserve the job logs and deployment state,
then follow the [rollback plan](06-rollback-plan.md). Do not retry migrations
or edit state/identity values merely to make preflight pass.

## Evidence to collect before declaring CI/CD operational

Record real, redacted evidence for each environment:

- protected-branch and Environment policy screenshots/exports;
- runner identity, labels, OS/patch level, and least-privilege review;
- exact deployment commit and clean-checkout verification;
- workflow run URL and migration mode;
- preflight, health, readiness, and public HTTPS result;
- alert and error-tracking confirmation; and
- backup plus isolated restore drill reference for releases that alter data.

Until this evidence exists, CI/CD status is **workflow definitions present;
environment and runtime verification pending**.
