# Burgundy Residences

Community platform for **Burgundy Residences**, a cluster housing estate under RW 012 —
a public website, a resident PWA, and an admin console over one data layer.

The thing that makes it more than a brochure: residents can **borrow the RW's shared
equipment** (chairs, carpets, speakers, portable AC, tents, a generator) with real
per-day availability, and the officers approve, hand over, and receive it back
through the same system.

---

## Three surfaces, one codebase

| Surface | Route | Who |
|---|---|---|
| Public website | `/` | Anyone — info, facilities, equipment catalogue, announcements, contact |
| Resident PWA | `/app/*` | Verified residents — installable, works offline |
| Admin console | `/admin/*` | RT / RW / treasurer / security / admin |

## Modules

Equipment lending · Facility booking · IPL dues + payment verification ·
Cash-book with a public transparency report · Complaints (lapor warga) with a
threaded workflow · Announcements · Events with RSVP · Guest passes with QR +
gate log · Resident, household and vehicle records · Site CMS · Audit trail

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Availability engine + permission matrix suites (52 assertions) |
| `npm run smoke` | Browser smoke test — needs `npm run preview` running |

### Demo accounts

Password for all of them: `Burgundy2026!`

| Email | Role |
|---|---|
| `warga@burgundy.id` | Resident |
| `rt@burgundy.id` | RT head — approvals, complaint triage |
| `bendahara@burgundy.id` | Treasurer — dues, cash book |
| `satpam@burgundy.id` | Security — gate log, guest verification |
| `admin@burgundy.id` | Administrator — everything |

---

## Data layer

The app ships in **local demo mode**: data lives in `localStorage`, seeded on first
load, private to the browser. Everything works — you can book, approve, pay, report.

To move to a real backend:

1. Create a Supabase project
2. Run `supabase/migrations/0001_init.sql` against it
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Call signatures are identical across drivers, so no screen changes.

### Where the rules actually live

`src/db/permissions.ts` is a real capability matrix, and every repository mutation
calls `assertCan` before it does any work — the UI hiding a button is presentation,
not enforcement. But in demo mode that check runs in the resident's own browser, so
it is **advisory**: it protects against mistakes, not against a determined user with
devtools. That is inherent to having no server, and it is why the SQL matters.

`supabase/migrations/0001_init.sql` is the enforced boundary. Row Level Security is
on for every table, mirroring the same matrix, and it was **executed and tested
against a real PostgreSQL 16** rather than written and hoped for. Verified there:

- a resident sees only their own dues, complaints, and profile
- a resident cannot mark their own bill paid — only attach proof for verification
- a resident cannot file a booking as another resident, or pre-approve their own
- internal officer notes on a complaint are invisible to the reporter
- audit rows cannot be forged from the client
- **privilege escalation is blocked** — see below

#### One bug this caught

The first version guarded `profiles.role` with a column-privilege `REVOKE`. Testing
it against real Postgres showed a resident could still promote themselves to admin,
because Supabase's default privileges re-grant `ALL` on new tables and any later
blanket `GRANT` silently undoes the revoke.

The fix is a trigger that is deliberately `SECURITY INVOKER`, so `current_user`
reflects the caller. A direct `UPDATE` from the client runs as `authenticated` and is
refused; the officer functions are `SECURITY DEFINER`, so inside them `current_user`
is the table owner and the change is allowed. A session GUC would not have worked —
any client can call `set_config` on itself. `current_user` cannot be forged, because
switching role requires real membership.

### Booking availability

`src/db/availability.ts` answers "can this resident take 20 chairs from the 3rd to
the 6th?" with a **peak-concurrency sweep**, not `SUM(qty)` over overlapping rows.
Summing over-counts bookings that overlap the *request* but not *each other*, and
wrongly rejects valid bookings. The SQL trigger `check_equipment_capacity()` is the
exact twin of that logic, serialised by a transaction-scoped advisory lock so two
residents racing for the last unit cannot both win.

Facility double-booking is refused by a Postgres `EXCLUDE` constraint — no
application bug can create one.

---

## Layout

```
src/
  db/            schema, permissions, availability engine, repository, auth, seed
  lib/           dates (WIB-safe), money, ids, PBKDF2, validation
  components/ui/ design system
  pages/site/    public website
  pages/app/     resident PWA
  pages/admin/   admin console
supabase/migrations/  the schema + RLS that becomes the real boundary
```

## Design

Burgundy heritage-modern — deep wine `#6B1F3A`, warm cream, brass hairlines, an arch
motif, Fraunces over Inter. Tokens live in `src/index.css`; no component hard-codes a
colour outside them.

## Stack

React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) · Vite 6 · Tailwind v4 ·
React Router 7 · Motion · Lucide · Supabase-ready
