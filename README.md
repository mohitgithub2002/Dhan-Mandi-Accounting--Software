# मंडी खाता · Mandi Khata

Hindi-and-English accounting for a **kachi arhat** firm in Hanumangarh Town Nai Dhan
Mandi. One dheri entry (aamad → boli → tulai) produces the kisan parchi, the
vyapari bill and every khata entry, with all kharcha and tax rates editable by the
firm. Next.js + PostgreSQL, A4 printing.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Implementation plan, accounting design and status: [docs/PLAN.md](docs/PLAN.md)
- Running the shop server, backups and go-live: [docs/OPERATIONS.md](docs/OPERATIONS.md)

## What is in this build (PRD Phase 1)

| Area | Screens |
| --- | --- |
| Season entry | Dheri Entry (aamad + boli + tulai in one keyboard form with live parchi/bill panel, Save + Print), Aamad list, Boli sheet (split across vyaparis, bhav-range warning), Tulai sheet (total or bag-wise) |
| Documents | Kisan parchi and vyapari bill: make (per day or per dheri), view, edit with reason (auto re-post, same number), radd, peshgi recovered, A4 prints (Original / Nakal, Hindi / English / both, parchi half-A4) |
| Money | Jama (receipt with TDS 194Q/194H and bill allocation), Naam (kisan payment, peshgi with byaj rate, kharcha, contra), raseed print, cash-limit warning |
| Books | Khata with *byaj sahit* toggle and drill-down, rokad and bank books with physical cash count, nakal (day book), din band / reopen, byaj run (preview → post) |
| Reports | Lena-dena with ageing, parchi and bill registers, jins-wise bikri, arhat aamdani, mandi shulk register (+ mark return filed), kharcha-wise, TDS, trial balance, audit log — on screen, A4 print with page totals, Excel |
| Masters | Party (khata) with byaj rule and duplicate warning, jins, **kharcha / tax master** (rate history, party overrides, deactivate, test calculator) |
| Admin | Firm and print settings, users and roles, shabd (rename screen words), backup + pen-drive download, financial-year lock |

## Quick start (development)

Requirements: Node 22, PostgreSQL 16.

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate              # schema + integrity triggers
npm run db:seed                 # firm, accounts, jins, Hanumangarh kharcha presets, malik login
npx tsx scripts/seed.ts --demo  # optional: sample kisans, vyaparis, bank and users
npm run dev                     # http://localhost:3000
```

Log in with `SEED_ADMIN_MOBILE` / `SEED_ADMIN_PASSWORD` (default `9999999999` /
`admin123` — change it in Settings → Users). Demo users (with `--demo`): munim
`9000000001`, operator `9000000002`, CA `9000000003`, password `demo123`.

## Keyboard

| Key | Action |
| --- | --- |
| Enter / Esc | Next / previous field (Enter on the last field saves) |
| Ctrl+S | Save |
| Ctrl+P | Dheri Entry: save + print parchi · print pages: print |
| Alt+N | New dheri |
| F2 / F3 | Party search / jins |

## Tests

```bash
npm test          # calc unit tests + posting integration tests
npm run typecheck
npm run lint
```

The integration tests need `TEST_DATABASE_URL` (that database is wiped). They post
the PRD worked example end to end (parchi **1,22,475**, bill **1,27,216**) and check
that every voucher balances, numbers stay gapless after radd, din band blocks
posting, edits re-post with the same numbers, and the database rejects unbalanced
or edited ledger rows.

## Project layout

```
src/lib/calc/       pure money maths (decimal.js) — used by screen, posting and print
src/lib/server/     posting service, rates, ledger, byaj, reports, auth
src/actions/        server actions (role-checked, one DB transaction each)
src/app/(app)/      screens          src/app/print/   A4 print templates
src/db/schema.ts    Drizzle schema   drizzle/         SQL migrations + triggers
```
