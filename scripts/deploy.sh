#!/usr/bin/env bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm prisma:validate
pnpm build
pm2 reload ecosystem.config.cjs --env production
