# Local Development

1. Copy `.env.example` to `.env.local` and replace development placeholders.
2. Run `docker compose -f docker-compose.yml up -d postgres redis`.
3. Complete `pnpm install` to generate the sole `pnpm-lock.yaml`.
4. Run `pnpm prisma:validate` and `pnpm prisma:generate`. Do **not** run migration commands until the database plan is approved.
5. Run `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:e2e`.
6. Stop local infrastructure with `docker compose -f docker-compose.yml down`.

No production database, secret or payment provider is needed for these commands.
