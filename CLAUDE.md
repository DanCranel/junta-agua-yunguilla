# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Web app for the **Junta de Agua de Yunguilla** (a rural community water board in Ecuador): members look up how much they owe for water by **cédula + apellido**, and a treasurer manages members and confirms payments from a password-protected panel. It is a **demo/muestra**, deployed to Vercel with a Convex cloud backend.

**[PRD.md](PRD.md) is the source of truth for requirements** — read it before adding features. The project is mid-migration from **v1** (built: public lookup, admin auth, member CRUD, confirm/reject payment) to **v2** (planned: auto-calculated tariff, monthly `planillas`, payment history by year, multas). When in doubt about intended behavior, the PRD wins over the current code.

Audience is rural, elderly users → **simplicity, large fonts, high contrast, few steps** is a hard requirement, not a nicety. All UI text is in **Spanish (Ecuador)**; code identifiers are also Spanish.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack), localhost:3000
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # typecheck (see gotcha below re: convex/_generated)

npx convex dev       # connect/sync backend, generate convex/_generated, watch. Needs login.
npx convex dev --once  # one-shot deploy + codegen (used to deploy without leaving a watcher)
npx convex env set CLAVE_ADMIN 'clave'   # set the admin password (NOT stored in the repo)
npx convex env get CLAVE_ADMIN
npx convex data <tabla>                  # inspect a table (e.g. socios, sesiones)
npx convex import --table socios --replace file.jsonl -y   # reset/seed a table
```

There are **no automated tests**. Verify changes by typechecking and driving the running app in the browser.

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui on the frontend; **Convex** for database, server functions, and file storage; Vercel for hosting.

**Two surfaces, one Next app:**
- `app/page.tsx` — public member lookup. Calls the `socios.buscar` query with cédula + apellido. This is the only member-facing auth (weak by design, documented in the PRD).
- `app/admin/page.tsx` — treasurer panel. Password gate → session token → member management. All admin data flows through here.

**Convex backend (`convex/`):**
- `schema.ts` — tables and indexes. `estadoValidator` (por_pagar / en_revision / pagado) is exported here and reused in function args.
- `socios.ts` — member queries/mutations. Public `buscar`; admin `listar` / `crear` / `actualizar` / `eliminar` / `confirmarPago` / `rechazarPago` / `sembrarEjemplo`.
- `auth.ts` — admin auth. `iniciarSesion` checks the password against `process.env.CLAVE_ADMIN` and issues a session token stored in the `sesiones` table (8 h TTL). Exports helpers **`sesionActiva`** and **`requerirSesion`**.
- `config.ts` — bank account config (single doc).
- `lib.ts` — shared helpers `normalizar` (accent/case-insensitive) and `soloDigitos` (cédula matching).

**Auth model (important):** admin write operations are **not** trusted from the client. Every admin mutation takes a `token` argument and calls `requerirSesion(ctx, token)` (throws `ConvexError` if invalid); `listar` returns `[]` for an invalid token. The frontend keeps the token in `localStorage` under `juntaAdminToken` and validates it via the `validarSesion` query. When adding any admin function, thread the token through and guard it the same way.

## Conventions & gotchas

- **`convex/_generated` requires a Convex deployment.** It's created by `npx convex dev`. `.env.local` (gitignored) holds `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOYMENT`. If `tsc` errors are *only* "Cannot find module `./_generated/...`", the code is fine — run `npx convex dev --once` to regenerate. After editing `convex/*`, redeploy so types stay in sync.
- **Convex determinism:** inside queries/mutations use `Math.random()` and `Date.now()` (Convex handles these). Do **not** use `crypto.randomUUID()` in mutations — it is not documented as allowed. Token generation in `auth.ts` uses `Math.random()` for this reason.
- **shadcn/ui here uses Base UI, not Radix.** Composition uses the **`render` prop** (e.g. `<DialogTrigger render={<Button/>} />`), not `asChild`. Components live in `components/ui/`, added via `npx shadcn@latest add <name>`.
- **Tailwind v4:** no `tailwind.config.js`. Theme lives in `app/globals.css` via `@theme inline` + CSS variables. The base font size is bumped to 18px there for accessibility.
- **`CLAVE_ADMIN` is a Convex env var**, never committed. Convex env vars are per-deployment (dev vs prod set separately).
- **Payment states** are shared UI concern: labels/emojis/colors live in `lib/formato.ts` (`ESTADO_INFO`), alongside `dinero()` and `fechaLegible()`.
- **Windows dev environment.** Prefer the `cmd` shell over PowerShell for `npx` (PowerShell may block `npx.ps1` via execution policy).
