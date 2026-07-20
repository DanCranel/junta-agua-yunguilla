# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Web app for the **Junta de Agua de Yunguilla** (a rural community water board in Ecuador): members look up how much they owe for water by **cédula + apellido**, and a treasurer manages members and confirms payments from a password-protected panel. It is a **demo/muestra**, deployed to Vercel with a Convex cloud backend.

**[PRD.md](PRD.md) is the source of truth for requirements** — read it before adding features. The **v2 migration is built**: identity/`planillas` split, auto-calculated tariff (básica + excedente), monthly planillas, payment history grouped by year, multas, per-planilla comprobante upload, and PDF download. When in doubt about intended behavior, the PRD wins over the current code.

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
- `app/page.tsx` — public member lookup. Calls `socios.buscar` (cédula + apellido) → returns the socio identity + all their `planillas`. Renders the pending planilla with desglose, PDF download (`lib/pdf.ts`), bank account, comprobante upload, and history grouped by year (`<details>`). Weak-by-design auth, documented in the PRD.
- `app/admin/page.tsx` — treasurer panel. Password gate → session token → tabs for **Socios** and **Configuración**. Subcomponents live in `app/admin/_components/` (form-socio, registrar-lectura, historial-socio, configuracion, socio-card, comunes, tipos).

**Convex backend (`convex/`):**
- `schema.ts` — tables/indexes. Exports `estadoValidator` (por_pagar / en_revision / pagado), `tipoMultaValidator` (mora / minga / otro), `multaValidator`. Tables: `socios` (identity only), `planillas` (one per socio per month; `by_socio`, `by_socio_periodo`), `tarifa` (single doc), `config`, `sesiones`.
- `socios.ts` — identity only. Public `buscar` (returns socio + planillas); admin `listar` (each socio + latest `pendiente`) / `crear` / `actualizar` / `eliminar` (cascades planillas + comprobantes).
- `planillas.ts` — the cobro engine. `listarPorSocio`, `previsualizar` (live calc preview), `registrarLectura` (inherits `lecturaAnterior`, blocks readings below it), `editarLectura`, `agregarMulta` / `quitarMulta`, `confirmarPago` / `rechazarPago`, public `generarUrlSubida` / `adjuntarComprobante`.
- `tarifas.ts` — `obtener` (falls back to `TARIFA_POR_DEFECTO`) / `actualizar`.
- `config.ts` — bank account: `obtener` / `actualizar`.
- `seed.ts` — `sembrarEjemplo`: tarifa, config, 5 socios with planillas across 2025–2026.
- `auth.ts` — admin auth. `iniciarSesion` checks `process.env.CLAVE_ADMIN`, issues a session token in `sesiones` (8 h TTL). Exports **`sesionActiva`** and **`requerirSesion`**.
- `lib.ts` — `normalizar`, `soloDigitos`, and the calc core: `calcularConsumo`, `calcularMontoConsumo`, `calcularMontoTotal`, `sumaMultas`, `fechaHoyISO`, `ultimoDiaDelMes`, `TARIFA_POR_DEFECTO`.

**Money/dates are calculated, never hand-entered** (PRD RNF-05): `montoConsumo`/`montoTotal` come from `convex/lib.ts` in mutations; the admin `registrar-lectura` shows a read-only live preview via the `previsualizar` query. Presentation helpers (`dinero`, `fechaLegible`, `nombreMes`, `periodoLegible`, `ESTADO_INFO`, `TIPO_MULTA`) live in `lib/formato.ts`.

**Auth model (important):** admin write operations are **not** trusted from the client. Every admin mutation takes a `token` argument and calls `requerirSesion(ctx, token)` (throws `ConvexError` if invalid); `listar` returns `[]` for an invalid token. The frontend keeps the token in `localStorage` under `juntaAdminToken` and validates it via the `validarSesion` query. When adding any admin function, thread the token through and guard it the same way.

## Conventions & gotchas

- **`convex/_generated` requires a Convex deployment.** It's created by `npx convex dev`. `.env.local` (gitignored) holds `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOYMENT`. If `tsc` errors are *only* "Cannot find module `./_generated/...`", the code is fine — run `npx convex dev --once` to regenerate. After editing `convex/*`, redeploy so types stay in sync.
- **Convex determinism:** inside queries/mutations use `Math.random()` and `Date.now()` (Convex handles these). Do **not** use `crypto.randomUUID()` in mutations — it is not documented as allowed. Token generation in `auth.ts` uses `Math.random()` for this reason.
- **shadcn/ui here uses Base UI, not Radix.** Composition uses the **`render` prop** (e.g. `<DialogTrigger render={<Button/>} />`), not `asChild`. Components live in `components/ui/`, added via `npx shadcn@latest add <name>`. Only button/input/label/card/dialog/badge are installed — collapsibles use native `<details>/<summary>` and dropdowns use native `<select>` (accessible, no JS, good for the elderly audience). Adding shadcn components needs network + is interactive, so prefer native elements.
- **PDF** is generated client-side with `jspdf` in `lib/pdf.ts` (`descargarPlanillaPDF`).
- **Comprobante upload** uses the standard Convex flow: `planillas.generarUrlSubida` (mutation) → `fetch(url, {method:"POST", body:file})` → `planillas.adjuntarComprobante`.
- **Tailwind v4:** no `tailwind.config.js`. Theme lives in `app/globals.css` via `@theme inline` + CSS variables. The base font size is bumped to 18px there for accessibility.
- **`CLAVE_ADMIN` is a Convex env var**, never committed. Convex env vars are per-deployment (dev vs prod set separately).
- **Payment states** are shared UI concern: labels/emojis/colors live in `lib/formato.ts` (`ESTADO_INFO`), alongside `dinero()` and `fechaLegible()`.
- **Windows dev environment.** Prefer the `cmd` shell over PowerShell for `npx` (PowerShell may block `npx.ps1` via execution policy).
