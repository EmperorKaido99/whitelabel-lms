# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A white-label LMS platform built with Next.js (App Router), supporting multi-tenant deployments, SCORM 1.2/2004 package uploads, and CMI progress tracking.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server

# Build & Production
npm run build
npm start

# Linting
npm run lint

# Database
npm run db:push      # Push schema changes to SQLite (no migration history)
npm run db:migrate   # Create and apply a named migration
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed demo tenant + admin user (ts-node scripts/seed.ts)
```

No test suite is configured yet.

## Architecture

### Multi-Tenancy

All data models (`User`, `Course`, `Module`, `Package`, `Enrollment`, `Progress`) carry a `tenantId` field referencing `Tenant`. Every query must be scoped to a tenant. The auth JWT embeds `tenantId` and `role`; these are forwarded through the session via augmented next-auth types in `src/types/next-auth.d.ts`.

### Authentication

- **Auth.js v5** (`next-auth@^5.0.0-beta.30`) with the Prisma adapter.
- Config lives in `src/lib/auth/config.ts`; `handlers`, `auth`, `signIn`, `signOut` are exported from there and re-exported from `src/app/api/auth/[...nextauth]/route.ts`.
- Strategy: JWT (not database sessions). No password hashing is implemented yet — the credentials provider only checks email existence.
- Custom sign-in page: `/auth`.

### Database

- **Prisma** with SQLite in development (`file:./prisma/dev.db`).
- Schema: `prisma/schema.prisma`.
- Singleton Prisma client: `src/adapters/db/index.ts` (uses `globalThis` to avoid hot-reload duplication).
- `.env` sets `DATABASE_URL=file:./prisma/dev.db`. Run `npm run db:push` before first use.

### SCORM Upload Flow

1. **Client** (`src/app/admin/scorm/upload/page.tsx`) — drag-and-drop or file picker, sends `multipart/form-data` to `/api/admin/packages`.
2. **API route** (`src/app/api/admin/packages/route.ts`) — validates the ZIP, parses `imsmanifest.xml`, extracts files to `public/scorm/<packageId>/`, optionally uploads the raw ZIP to S3, and writes a `Package` row to the database.
3. **Local serving** — extracted SCORM files land under `public/scorm/` so Next.js serves them statically at `/scorm/<packageId>/`.
4. S3 upload and DB write are both **optional/graceful-fallback**: if `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are absent, S3 is skipped; if `DATABASE_URL` is absent or Prisma fails, the DB write is skipped.

### Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes (dev default in `.env`) | `file:./prisma/dev.db` for local SQLite |
| `AUTH_SECRET` | Yes for auth | Next-auth secret |
| `AWS_ACCESS_KEY_ID` | No | Skipped gracefully in dev |
| `AWS_SECRET_ACCESS_KEY` | No | Skipped gracefully in dev |
| `AWS_REGION` | No | Defaults to `us-east-1` |
| `S3_BUCKET` | No | Defaults to `whitelabel-lms-packages` |

### Key Conventions

- **Path alias**: `@/` maps to `src/` (configured in `tsconfig.json`).
- **Styling**: Inline styles + `<style jsx>` (styled-jsx, built into Next.js). Tailwind is installed but minimal global usage; IBM Plex Sans/Mono loaded from Google Fonts in the root layout.
- **`"use client"` directive**: All interactive pages use client components. API routes and auth config are server-only.
- **Lazy imports in API routes**: Auth and Prisma are dynamically imported inside route handlers to allow graceful degradation when env vars are missing.
- The `public/` directory is git-untracked (in `.gitignore` or via `??` status); extracted SCORM packages accumulate there during development.
