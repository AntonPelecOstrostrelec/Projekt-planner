# Pushnik

Projektový manažér s AI coachom, ktorý ti nedá pokoj. Viac-používateľská (multi-tenant) appka na správu projektov, deadlinov, deľby práce a nápadov.

> Status: **Fáza 0 – Foundation**. Stojí kostra: auth, workspaces, multi-tenant DB schéma s RLS, základný app shell.

---

## Tech stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **TailwindCSS** + shadcn/ui komponenty
- **Supabase** – Postgres + Auth + Realtime + Storage
- **Row-Level Security** na každej tenant tabuľke (workspace izolácia)
- Hosting target: Vercel + Supabase cloud

---

## Roadmap (fázy)

| Fáza | Obsah | Status |
|---|---|---|
| 0 | Foundation: auth, workspaces, RLS, app shell | ✅ |
| 1 | Projekty + tasky + Kanban + realtime sync | ⏳ |
| 2 | Kalendár (Google/Outlook), deadlines, notifikácie | ⏳ |
| 3 | Tím, deľba práce, kontakty, changelog | ⏳ |
| 4 | Ideas board + progress dashboards | ⏳ |
| 5 | AI coach (Claude API, 3 módy persóny) | ⏳ |
| 6 | Gamifikácia, stretch goals, shame leaderboard | ⏳ |
| 7 | Polish, PWA, integrácie (GitHub, Slack) | ⏳ |

---

## Lokálny setup

### 1. Predpoklady

- Node.js 20+
- npm (alebo pnpm)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (voliteľné, pre lokálny Postgres)
- Supabase projekt (cloud – stačí free tier)

### 2. Naklonuj & nainštaluj

```bash
git clone <repo>
cd Projekt-planner
npm install
```

### 3. Environment

Skopíruj `.env.example` do `.env.local` a vyplň:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY` dostaneš v Supabase projekte → Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` (pre backend / cron joby) drž v tajnosti, nikdy necommituj.

### 4. Databáza

Migrácie sú v `supabase/migrations/`. Dve možnosti:

**A) Supabase CLI (odporúčané na dev):**
```bash
supabase start           # lokálny Postgres na 54322
supabase db reset        # spustí migrácie
```

**B) Cloud Supabase:**
- Otvor projekt v Supabase Studio → SQL Editor
- Spusti postupne `supabase/migrations/0001_init.sql`, potom `0002_rls.sql`

### 5. Auth providery

V Supabase Dashboard → Authentication → Providers:
- Zapni **Email** (magic link)
- Voliteľne zapni **Google** a vyplň OAuth client ID / secret (z Google Cloud Console)

Pre lokálny development pridaj redirect URL: `http://localhost:3000/auth/callback`

### 6. Spusti appku

```bash
npm run dev
```

Otvor [http://localhost:3000](http://localhost:3000). Prihlás sa → vytvor workspace → hotovo.

---

## Skripty

| Príkaz | Čo robí |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Produkčný build |
| `npm run start` | Spustí produkčný build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:types` | Generuje TypeScript typy z DB schémy |

---

## Štruktúra

```
src/
  app/
    (app)/                 # chránené routy (vyžadujú login)
      layout.tsx           # app shell (sidebar + topbar)
      page.tsx             # dashboard
      workspaces/new/      # vytvor workspace
      w/[slug]/            # detail workspacu
    auth/callback/         # OAuth / magic link callback
    auth/signout/          # signout endpoint
    login/                 # prihlásenie
    layout.tsx             # root layout + theme provider
    globals.css            # tailwind + shadcn theme
  components/
    ui/                    # shadcn (button, input, card)
    layout/                # sidebar, topbar
    theme-provider.tsx
  lib/
    supabase/              # client, server, middleware helpers
    utils.ts
  middleware.ts            # chráni routy, refresh session
supabase/
  migrations/              # SQL migrácie
  config.toml              # Supabase CLI config
```

---

## Multi-tenant model

- **Workspace** = izolovaný priestor. Každý má vlastných členov, projekty, kontakty.
- **User** môže byť v ľubovoľnom počte workspaceov.
- **Role**: `owner` / `admin` / `member` / `guest`.
- **RLS**: Každý SELECT/INSERT/UPDATE automaticky filtruje podľa `workspace_id` a členstva. Dáta medzi workspaceami sú neprestupné.

---

## Contribuovanie

Branchuj z `main`, commit message v štýle `[feature] short desc`. Pred PR: `npm run typecheck && npm run lint`.
