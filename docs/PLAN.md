# Mandi Khata — Implementation Plan

This plan turns [PRD.md](./PRD.md) into a buildable system. It fixes the
architecture, the accounting rules, the order of work, and records every place
where the build deliberately differs from the PRD (and why).

---

## 1. Guiding principles

1. **One calculation module.** All money maths (rakam, katauti, kharcha, rounding,
   byaj, amount-in-words) lives in `src/lib/calc/` — pure TypeScript on
   `decimal.js`, no DB access, fully unit-tested. The Dheri Entry live panel,
   the posting service and the printed PDF all call the same functions, so they
   can never disagree.
2. **Double-entry, append-only books.** Every parchi, bill, jama, naam, contra,
   peshgi and byaj creates one `voucher` with `ledger_entries` that balance.
   A deferred constraint trigger rejects any voucher whose debits ≠ credits.
   Ledger rows and the audit log cannot be updated or deleted (DB triggers).
   Corrections are reversal vouchers (`reverses_id`).
3. **Snapshots, not references, for history.** Each parchi/bill stores the
   charge lines it used (`document_charges`: rate, basis, amount). Changing the
   rate master never changes a posted document.
4. **Server decides permissions.** Every server action calls
   `requireUser(permission)`; the browser only hides buttons.
5. **Mandi words on screen.** Labels come from the shabdavali dictionary
   (`src/lib/i18n`) with firm overrides from `custom_labels`.

---

## 2. Stack (as in PRD §11, with noted deviations)

| Layer | Choice |
| --- | --- |
| App | Next.js 15 App Router, React 19, TypeScript, server actions |
| DB | PostgreSQL 16, Drizzle ORM (schema + migrations), raw SQL for reports |
| Money | `decimal.js` in `src/lib/calc` |
| Validation | `zod` (shared client/server) |
| UI | Tailwind CSS v4, small in-house component set (`src/components/ui.tsx`) |
| Auth | Signed JWT session cookie (`jose`) + `bcryptjs`; 30-min sliding idle timeout; lock after 5 wrong attempts |
| i18n | In-house dictionary (`hi`, `en`) + `custom_labels` table overrides |
| Print | HTML A4 print templates with `@page` CSS and embedded Noto Sans / Noto Sans Devanagari (`@fontsource`) → browser "Save as PDF" (server-side PDF rendering is a later item) |
| Excel | ExcelJS (`/api/export/[report]`) |
| Tests | Vitest (calc unit tests + DB integration tests of posting) |
| Deploy | Docker Compose (app + Postgres + hourly backup sidecar) — PRD option A |

**Deviations and why**

- *Auth.js → own JWT session.* Auth.js credentials provider adds little for
  mobile + password login and does not cover lockout/idle timeout; a 100-line
  `jose` session is simpler to audit. Same behaviour as PRD §11 Security.
- *next-intl → own dictionary.* The app has no locale-prefixed routes (language
  is a per-user preference, PRD §9 rule 2) and needs DB overrides per label;
  a typed dictionary + provider is smaller and does both.
- *shadcn/ui, TanStack Table, react-hook-form → plain components.* Grids here
  are keyboard-driven entry sheets with a few columns; hand-built inputs with an
  Enter-to-next-field hook give tighter keyboard control with fewer deps.
- *pg-boss → not in Phase 1.* Byaj runs are interactive (preview → post) and
  backups run in a compose sidecar with cron; a job queue is added when PDF
  batches / SMS arrive (Phase 3).

---

## 3. Accounting design

### 3.1 Chart of accounts (seeded, `accounts.code`)

| Code | Name (hi / en) | Group (nature) |
| --- | --- | --- |
| `CASH` | रोकड़ / Cash | Cash-in-hand (asset) |
| `SALE_CLEARING` | बिक्री उचंत / Sale clearing | Suspense (liability) |
| `ARHAT_INCOME` | आढ़त आमदनी / Arhat income | Income |
| `DHANKA_INCOME` | धनका खाता / Dhanka | Income |
| `BARDANA_INCOME` | बारदाना खाता / Bardana | Income |
| `BYAJ_INCOME` | ब्याज आमदनी / Interest income | Income |
| `MANDI_SAMITI` | मंडी समिति देय / Mandi samiti payable | Duties & taxes (liability) |
| `KKS_PAYABLE` | कृषक कल्याण शुल्क देय | Duties & taxes (liability) |
| `TULAI_KHATA` | तुलाई खाता / Weighing (tulaiya) | Labour (liability) |
| `PALLEDAR` | पल्लेदार खाता / Palledar | Labour (liability) |
| `JHARAI_KHATA` | झराई खाता / Cleaning | Labour (liability) |
| `TDS_RECV` | टीडीएस प्राप्य / TDS receivable | Current assets |
| `ROUND_OFF` | राउंड ऑफ / Round off | Expense |
| `BIJLI`, `KIRAYA`, `SALARY`, `MISC_EXP` | Expense heads | Expense |

Kisans, vyaparis, agencies, labour contractors, transporters and banks are rows
in the same `accounts` table with a `party_type`. Debit = **naam**, credit =
**jama**. A kisan's balance is normally jama (firm owes him), a vyapari's naam.

### 3.2 Posting rules

`amount` below is the lot sale's rakam after value katauti (stored on
`lot_sales.amount`, so both documents use the identical figure).

| Document | Debit (naam) | Credit (jama) |
| --- | --- | --- |
| Vyapari bill | Vyapari — bill total | `SALE_CLEARING` — Σ amount; each vyapari-side posted charge → its account; round-off → `ROUND_OFF` |
| Kisan parchi | `SALE_CLEARING` — Σ amount | Kisan — parchi net; each kisan-side posted charge → its account; round-off → `ROUND_OFF` |
| Jama (receipt) | Cash / bank — amount; `TDS_RECV` — TDS | Party — amount + TDS |
| Naam (payment, peshgi) | Party — amount | Cash / bank |
| Kharcha payment | Expense / payable account | Cash / bank |
| Contra | To cash/bank | From cash/bank |
| Byaj | Party | `BYAJ_INCOME` |
| Radd / edit | Reversal voucher: every line of the original with sides swapped |

`SALE_CLEARING` returns to zero once both the parchi and the bill for a lot
sale exist — its balance is a built-in control ("sold but not yet billed").

*Peshgi* is posted to the kisan's own khata (naam). "Peshgi recovered" on a
parchi is a printed netting (net payable = parchi net − peshgi recovered), not a
separate posting, because both sit in the same khata.

*Show-only* charges (e.g., mandi shulk when the vyapari pays the samiti
directly) are printed on the document but neither posted nor added to totals.

*Sarkari kharid* (sale_type `sarkari`, buyer = agency account): with firm
setting `sarkari_credit_kisan = false` (default), rakam is not posted; the bill
posts only the agency-side charges (arhat ₹/qtl, labour) as agency naam and the
parchi posts only kisan-side charges. With the setting on, it posts like a
private sale.

### 3.3 Charge engine (PRD §6)

`charge_heads` holds the definition (kind, basis, payer, split, posts-to,
kram, rounding, print flags, sale type, override allowed, active-from/to);
`charge_rates` holds the rate history with optional `commodity_id` (per-jins
rate, e.g., mandi shulk group) and optional `account_id` (party override).

**Rate resolution** for (head, date, jins, party): among rows effective on the
date, pick the most specific: party+jins → party → jins → generic. Party rows
are used only when the head allows overrides. No row ⇒ the line is skipped
(so a blank preset such as krishak kalyan shulk simply does not apply until a
rate is entered). A head with only jins-specific rows therefore applies only to
those jins — this is how "applies to selected jins" is modelled.

**Calculation order** (one document): lines' amounts → for each head in kram
order compute the full amount from its basis (`pct_amount`, `per_qtl`,
`per_bag`, `fixed_doc`, `pct_of_line` → referenced head's full amount) → round
per head → take the side's share (split %) → sum posted lines → round the total
per firm rule; the difference goes to `ROUND_OFF`.

*Katauti* heads (`kind = katauti`) cut value per lot sale at tulai time and are
stored on the sale (`value_cut`), so parchi and bill agree to the paisa.
Weight katauti (bag tare, nami %, dust kg) are tulai fields.

### 3.4 Numbering

`number_series (doc_type, fy_id)` row is locked `FOR UPDATE` inside the posting
transaction ⇒ gapless numbers per financial year for aamad, parchi, bill, jama,
naam, contra, journal, byaj, reversal. Radd keeps the number.

### 3.5 Byaj

Daily-product method: for each day in the period the naam balance (after the
grace days / credit days) is added to the product;
`interest = product × rate% ÷ 100 ÷ days_in_month (firm setting, default 30)`,
rounded to the rupee. Methods: `simple` (whole period), `monthly` (calculated
and rounded per calendar month), `compound` (posted byaj enters the balance —
natural, because it is in the ledger). Vyapari overdue byaj uses only the
portion of the balance older than the credit days.

### 3.6 Din band

`day_closes` row per date. Any posting, edit or radd dated on a closed day is
rejected in the service layer. Munim/malik close; only malik reopens with a
reason (audit-logged).

---

## 4. Code layout

```
src/
  app/
    login/                 sign-in
    (app)/                 authenticated shell (header, menu, shortcuts)
      page.tsx             Home — aaj ka saar
      dheri/ aamad/ boli/ tulai/ parchi/ bill/ jama/ naam/
      khata/ rokad/ nakal/ byaj/ report/ master/ settings/
    print/                 A4 print templates (parchi, bill, raseed, khata)
    api/export/ api/pdf/ api/backup/
  actions/                 server actions (one file per module)
  db/schema.ts             Drizzle schema
  db/index.ts              connection
  lib/calc/                pure money maths (tested)
  lib/server/              auth, permissions, posting, rates, ledger, reports, audit
  lib/i18n/                dictionaries + provider
  components/              UI building blocks, party search, keyboard hooks
drizzle/                   SQL migrations (generated + custom triggers)
scripts/                   migrate, seed, backup
tests/                     vitest suites
```

---

## 5. Work breakdown and status

### Phase 1 — season-ready core (built)

| # | Work item | PRD | Status |
| --- | --- | --- | --- |
| 1 | Repo, tooling, Docker Compose (app + Postgres + backup sidecar) | §11 | ✅ |
| 2 | Schema + migrations + balance / immutability triggers | §10 | ✅ |
| 3 | Seed: firm, FY, malik user, groups, system accounts, jins, Hanumangarh kharcha presets | §5.1, §6 | ✅ |
| 4 | Calc module + unit tests (worked example 1,22,475 / 1,27,216; byaj; words) | §6, §12 | ✅ |
| 5 | Auth, roles, permission matrix, 30-min idle timeout, lock after 5 attempts | §2, §11 | ✅ |
| 6 | Hindi / English dictionary, language toggle per user, shabd overrides | §3, §9 | ✅ |
| 7 | Masters: party (+ byaj rule, duplicate warning), jins, kharcha/tax master (rate history, overrides, deactivate, hard delete if unused, test calculator) | §5.1, §6 | ✅ |
| 8 | Dheri Entry (aamad + boli + tulai, live panel, keyboard-only, Save + Print) | §5.2–5.4, §9 | ✅ |
| 9 | Aamad list, Boli sheet (split, bhav warning), Tulai sheet (total / bag-wise) | §5.2–5.4 | ✅ |
| 10 | Posting: parchi, bill, radd, edit-with-repost, peshgi recovered, gapless numbering | §5.5–5.6, §10 | ✅ |
| 11 | Jama-naam: receipts (+TDS, bill allocation), payments, peshgi, kharcha, contra, raseed | §5.7 | ✅ |
| 12 | Rokad and bank book with physical count | §5.8 | ✅ (bank statement import is P1 — not built) |
| 13 | Khata with byaj-sahit toggle and drill-down, A4 print | §5.9 | ✅ (WhatsApp share is P1 — not built) |
| 14 | Byaj run: preview → post, simple / monthly / compound, grace & credit days | §5.10 | ✅ |
| 15 | Nakal and din band / reopen | §5.13 | ✅ |
| 16 | Reports + Excel export + A4 print with running page totals | §7 | ✅ |
| 17 | A4 prints: parchi (full / half), bill, raseed, khata, registers; Original / Nakal | §8 | ✅ via browser print / Save as PDF |
| 18 | Settings: firm, number series view, users, shabd, backup, FY lock | §9 | ✅ |
| 19 | Audit log for edits, radd, rate changes, reopen, prints | §2, §12 | ✅ |

### Phase 2 items already included

Mandi shulk register with "mark return filed" (challan no. and date), kharcha-wise
report, TDS register, trial balance, financial-year lock/unlock, basic sarkari kharid
(agency as buyer, ₹/qtl arhat, `sarkari_credit_kisan` setting).

### Not built yet (Phase 2 / 3)

Kisan hisab and carry-forward, sarkari kharid agency report, 26AS import and milan,
P&L and balance sheet, year-end carry-forward, bank statement import, malik phone
view, SMS/WhatsApp, template editor, e-NAM export, Tally export, server-side PDF
rendering (`/api/pdf` with headless Chromium — prints currently use the browser's
"Save as PDF", which embeds the same fonts), pg-boss job queue.

### Known limitations to review with the firm

- Opening balances are a field on the party (included in every balance), not an
  opening voucher; the trial balance includes them.
- Arhat and mandi-shulk reports split a bill's charges across its jins lines in
  proportion to each line's amount.
- Report prints paginate at a fixed 26 rows per page; very long text cells can wrap.

## 6. Testing strategy

- **Unit (no DB):** `tests/calc.test.ts` — PRD worked example to the rupee,
  every basis and rounding mode, split payer, show-only, katauti, weight
  formatting, Indian number format, amount in words (hi/en), byaj daily product
  against a hand calculation.
- **Integration (needs `TEST_DATABASE_URL`):** `tests/posting.test.ts` — seeds a
  fresh DB, posts dheri → parchi → bill → receipt, asserts every voucher
  balances, clearing returns to zero, numbers are gapless, radd reverses,
  closed day rejects posting, unbalanced voucher is rejected by the trigger.

## 7. Go-live checklist (from PRD §13)

See PRD §13; the open questions in PRD §14 map to settings that already exist:
charge payer/rate/posting (kharcha master), mandi shulk collect vs show-only
(`post_mode`), parchi/bill grouping (firm settings), peshgi recovery (munim's
choice on the parchi), byaj rule per party, katauti defaults per jins.
