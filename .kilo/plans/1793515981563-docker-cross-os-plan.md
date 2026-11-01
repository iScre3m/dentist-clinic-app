# Docker Plan for Dr. Laura Practice Admin

## Goal
Make the SvelteKit app (SQLite + Better Auth + Google Calendar + wa.me) runnable cross-OS with Docker (dev and simple prod-like run). Keep changes minimal and aligned with MVP constraints (no background workers/scheduler/CI). 

## Current state (confirmed)
- SvelteKit + Svelte 5, adapter-node, Tailwind, shadcn-svelte, pnpm
- SQLite via better-sqlite3, Drizzle ORM/migrations, DB file at `DATABASE_PATH` (default `./local.db`), WAL on
- Better Auth, single staff account, scripts: `db:seed`, `db:prune`, `staff:update`
- Env via `.env` (vars in `.env.example`): `DATABASE_PATH`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON` (base64), `GOOGLE_CALENDAR_ID`, `FAKE_CALENDAR`, `SEED_STAFF_*`
- No Docker files present
- Build: `pnpm build`, preview/run via adapter-node

## Decisions to confirm (ask user if needed)
1. **Target runtime**: Dev container (`docker compose` with hot reload / bind mount) and/or production image (`node` + built app + mounted SQLite)? Recommend both.
2. **Node version**: Use LTS (Node 22) to match `@types/node` ~26? package.json shows `@types/node` ^26.6.6 but Node 26 may not be LTS; safer Node 22 LTS.
3. **Base image**: `node:22-slim` (smaller) vs `node:22` (more build deps). better-sqlite3 needs build tools; `-slim` needs `python3 make g++`.
4. **SQLite persistence**: Mount volume for `DATABASE_PATH` dir/file (e.g. `./data:/app/data`, set `DATABASE_PATH=/app/data/local.db`). Never put DB in image.
5. **Secrets**: Pass `.env` via compose/env_file or secrets; never bake `GOOGLE_SERVICE_ACCOUNT_JSON`. 
6. **Init**: Should container auto-run `db:migrate` and optionally `db:seed` on first start? Or document manual commands? Seed refuses in prod and is idempotent.
7. **Port**: Default 5173 dev, prod preview/build run on 3000? adapter-node default port 3000 unless PORT set.
8. **Platform**: linux/amd64 target? For cross-OS dev ok.
9. **FAKE_CALENDAR**: Keep for tests/dev.

## Plan

### 1) Add Dockerfiles
- `Dockerfile.dev` (dev): 
  - base node:22-slim, install pnpm via corepack
  - install deps (include build deps for better-sqlite3)
  - copy source, run `pnpm dev --host 0.0.0.0 --port 5173`
- `Dockerfile` (prod):
  - multi-stage: builder (install deps, build with `pnpm build`), runner (copy build output + node_modules prod deps? or use adapter-node output)
  - adapter-node outputs to `build/` (index.js + client). Need `node build/index.js`, set PORT/ORIGIN/HOST as needed
  - run as non-root user
  - mount data volume for DB

### 2) Add docker-compose
- `docker-compose.dev.yml`: app service, volume mount source for HMR, volume for data (`./data`), env_file `.env`, ports 5173:5173
- `docker-compose.yml` (prod-like): app service, build from Dockerfile, volume for data, env_file `.env`, ports 3000:3000, depends on nothing

### 3) Env/paths
- Update `.env.example` to note Docker paths (e.g. `DATABASE_PATH=/app/data/local.db`) and advice
- Ensure `src/lib/server/db/index.ts` uses `DATABASE_PATH` as-is (it does). Create data dir in container.

### 4) Scripts/entrypoint
- Optional `docker/entrypoint.sh`: wait for dir, run `pnpm db:migrate` if DB missing/schema not applied? Or just document. For simplicity document: run migrate+seed manually or add script.
- Better: add `docker-entrypoint` that does `pnpm db:migrate` then exec CMD. Seed only if empty and not prod? Keep manual per README.

### 5) Docs
- Add `DOCKER.md` with quickstart (dev/prod), env setup, migrate/seed, backups, notes about Google key/base64, ports.
- Update `README.md` with Docker section (link DOCKER.md)

### 6) .dockerignore
- node_modules, .git, .env, local.db, data/, build/, .svelte-kit/, drizzle/meta caches? Keep drizzle migrations.

## Validation
- Build dev image: `docker compose -f docker-compose.dev.yml build`
- Run dev: migrate/seed, access app
- Build prod: `docker build -t dentist-admin . && docker run ...`
- Verify SQLite persists across restart
- Verify HMR in dev
- Check better-sqlite3 builds on linux

## Risks
- better-sqlite3 native module: need build tools in image
- WAL files: ensure volume mounted on same dir
- Auth URLs: `BETTER_AUTH_URL`/`APP_URL` must match host/port
- Google service account JSON: pass as base64 env (ok)
- pnpm version via corepack

## Files to create
- `Dockerfile`
- `Dockerfile.dev`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.dockerignore`
- `DOCKER.md`
- `docker/entrypoint.sh` (optional)
