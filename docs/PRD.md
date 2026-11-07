# Mandi Khata — PRD (Kachi Arhat Accounting, Hanumangarh Town)

Nov 7, 2026 · @Mohit Goyal

## 1. Overview

**Mandi Khata** is a Hindi-and-English accounting app for one kachi arhat firm in Hanumangarh Town Nai Dhan Mandi. It turns each dheri (lot) — after boli and tulai — into a kisan parchi, a vyapari bill and every khata entry, with all kharcha and tax rates editable by the firm. It is built with Next.js and PostgreSQL, and prints on A4.

**Problem today.** The munim writes the same sale three or four times: in the aamad register, the parchi, the vyapari bill and the bahi. Charges are worked out by hand, interest on kisan advances is calculated at season end, and buyer TDS on full sale value does not match the books. Errors and delays cost money and trust.

**Goals**

| Goal | Measure of success |
| --- | --- |
| One entry per sale | Parchi, bill and all khata entries created from one dheri entry; zero re-typing |
| Fast in season | A dheri from boli to printed parchi in under 60 seconds by a trained operator |
| Correct charges | 100% of kharcha and taxes calculated from the rate master; no manual totals |
| Up-to-date khata | Any kisan or vyapari balance, with byaj, shown in under 2 seconds |
| Simple for the munim | Munim works the app without training beyond one sitting; every label in familiar mandi words |
| Ready for CA | Year-end trial balance, mandi shulk register and TDS reconciliation exported in one click |

**In scope**

- One firm (one licence, one set of books), multiple users on the same data.
- Kachi arhat sales on behalf of kisans to vyaparis, for every jins (commodity): wheat, paddy, mustard, guar, gram, cotton, barley, moong and any the firm adds.
- Sarkari kharid (government MSP procurement) lots, with per-quintal arhat.
- Full double-entry accounts: rokad, bank, khata, nakal (day book), jama-naam, byaj, hisab.
- Every charge and tax as a configurable line: add, delete (deactivate), change rate with effective date.
- Hindi and English UI and prints, A4 printing.

**Out of scope for v1**

- Pakki arhat (buying for outside principals) and own-account trading (khud ka vyapar) — the data model leaves room for them.
- Multiple firms or branches.
- GST e-invoice and e-way bill generation (commission on agri produce is exempt; revisit if own trading is added).
- Direct integration with e-NAM or the Rajasthan e-mandi portal — export files only.
- Electronic weighbridge integration — manual weight entry in v1.
- Payroll for palledars beyond a simple labour khata.

## 2. Users and roles

Four roles cover a single firm; the malik decides who gets which role.

| Role | Who | Typical work |
| --- | --- | --- |
| Malik (owner / admin) | Firm owner or partner | Sees everything, sets rates, approves edits after day close, manages users, backups |
| Munim (accountant) | Senior accountant | All entries, jama-naam, byaj, hisab, reports, day close |
| Operator | Shop clerk in season | Aamad, boli, tulai entry, print parchi and bill; no edits after print |
| CA (view only) | Firm's chartered accountant | Read reports and registers, export to Excel/PDF; no entry |

**Permissions**

| Action | Malik | Munim | Operator | CA |
| --- | --- | --- | --- | --- |
| Aamad, boli, tulai entry | Yes | Yes | Yes | No |
| Print parchi / bill | Yes | Yes | Yes | No |
| Edit a printed parchi or bill | Yes | With reason | No | No |
| Cancel (radd) a parchi or bill | Yes | No | No | No |
| Jama-naam (receipts, payments) | Yes | Yes | No | No |
| Kharcha / tax rate master | Yes | No | No | No |
| Byaj run, hisab (settlement) | Yes | Yes | No | No |
| Day close and reopen | Close and reopen | Close only | No | No |
| Reports and export | Yes | Yes | Own day's list | Yes |
| Users, backup, settings | Yes | No | No | No |

Every edit or radd after print stores who, when, old value, new value and reason in the audit log.

## 3. Shabdavali — words used on screen

The app speaks the mandi's language: these words are the menu items, field labels and print headings. In English mode the English label shows, with the Hindi word in brackets where staff know only the Hindi.

| Screen word (Hindi) | English label | Meaning in the app |
| --- | --- | --- |
| आमद (Aamad) | Arrival | Kisan's produce entering the shop, with gate entry no. |
| ढेरी (Dheri) | Lot | One heap of one jins from one kisan; the unit of sale |
| जिंस (Jins) | Commodity | Wheat, paddy, sarson, guar, chana, etc. |
| बोली (Boli) | Auction | Vyapari who won and bhav per quintal |
| भाव (Bhav) | Rate | Rupees per quintal |
| तुलाई (Tulai) | Weighing / weighing charge | Weight entry screen, and the charge for it |
| कट्टा / बोरी (Katta / Bori) | Bag | Count of bags in a dheri |
| बारदाना (Bardana) | Gunny bags | Bags supplied and charged |
| कटौती (Katauti) | Deduction | Weight cut for bag tare, nami (moisture), dust |
| किसान पर्ची (Kisan Parchi) | Farmer sale voucher (J-form) | What the kisan gets: sale value minus his kharcha |
| व्यापारी बिल (Vyapari Bill) | Buyer bill (I-form) | What the vyapari pays: sale value plus market charges |
| नकल (Nakal) | Day book / duplicate copy | All entries of the day in order; also the office copy of a parchi or bill |
| आढ़त / दामी (Arhat / Dami) | Commission | The firm's earning per sale |
| धनका (Dhanka) | Dhanka charge | Local mandi charge (% of value); meaning and payer set by the firm |
| पल्लेदारी / हम्माली (Palledari / Hammali) | Labour | Loading, unloading, carrying |
| झराई (Jharai) | Cleaning | Sieving / cleaning per quintal |
| भराई, सिलाई (Bharai, Silai) | Filling, stitching | Per-bag labour after tulai |
| मंडी शुल्क (Mandi Shulk) | Market fee | % of value paid to mandi samiti |
| कृषक कल्याण शुल्क (Krishak Kalyan Shulk) | Farmer welfare fee | % of value, Rajasthan |
| खाता (Khata) | Ledger account | Account of any party |
| जमा / नाम (Jama / Naam) | Credit / Debit | Two sides of every khata |
| रोकड़ (Rokad) | Cash book | Daily cash in and out, opening and closing |
| पेशगी (Peshgi) | Advance | Money given to kisan before the crop |
| ब्याज (Byaj) | Interest | On peshgi and on overdue vyapari balance |
| भुगतान (Bhugtan) | Payment | Money paid or received, cash or bank |
| हिसाब (Hisab) | Settlement | Season-end statement of a kisan's khata |
| सरकारी खरीद (Sarkari Kharid) | Govt procurement | MSP lots bought by FCI / Rajfed |
| रद्द (Radd) | Cancel | Cancels a parchi or bill with reason; never deletes |
| दिन बंद (Din Band) | Day close | Locks the day's entries |

Words not on this list can be renamed by the malik in Settings → Shabd (labels), so each firm's own words show.

## 4. Daily workflow

In season the operator enters only aamad, boli and tulai; the kharcha engine produces the kisan parchi and vyapari bill, and both khatas are posted at once.

&#91;embedded content: daily workflow · 3 entry steps, kisan side and vyapari side, day close\]

The left column is the kisan's money, the right column the vyapari's; both meet in rokad/bank, and the munim closes the day after checking the nakal against cash in hand.

## 5. Functional requirements by module

Each module below lists what it does, the fields, the rules the system enforces, and how we test it is done. Priority: **P0** = needed for the first season, **P1** = within the season, **P2** = later.

### 5.1 Masters (P0)

**Party (khata) master** — one record per kisan, vyapari, sarkari agency, palledar/labour contractor, transporter, bank, and expense head.

- Fields: name (Hindi + English), father's name, gaon (village), tehsil, mobile, party type, opening balance with jama/naam side, PAN, Aadhaar last 4 digits only, bank name, account no., IFSC, GSTIN (vyapari), mandi licence no. (vyapari), byaj rule (rate % per month, from-date, simple/compound), credit days (vyapari), active/inactive.
- Rules: mobile unique per party type; duplicate-name warning shows existing party with the same name and gaon; a party with entries cannot be deleted, only made inactive.
- Search by name in Hindi or English, gaon, mobile, or khata number from any screen (F2).

**Jins master** — commodity list preloaded: gehun (wheat), dhan (paddy), sarson (mustard), guar, chana (gram), jau (barley), kapas (cotton), moong, bajra, moth, til; firm can add more.

- Fields: name (Hindi + English), HSN code, unit (quintal default), mandi shulk group (1.60% / 1.00% / 0.50%), standard bag weight (kg), default katauti per bag (kg), MSP rate and season (optional), active.

**Firm settings** — firm name, licence no., address, PAN, GSTIN (if any), bank accounts, logo, financial year, parchi and bill number series, print language default, rounding rules.

### 5.2 Aamad — arrival (P0)

Records produce reaching the shop before boli.

- Fields: date, aamad no. (auto), mandi gate entry no., kisan (search or quick-add), vehicle no., jins, estimated bags, remarks.
- Quick-add kisan: only name, gaon and mobile are required; rest can be filled later.
- One aamad can create one or more dheris (same kisan, different jins or quality).
- Acceptance: aamad saved in under 15 seconds; today's aamad list shows dheris pending boli.

### 5.3 Boli — auction (P0)

- Fields: dheri, vyapari (search), bhav per quintal, boli time.
- A dheri may be split across vyaparis (part bori to each) — each part becomes its own sale line.
- Bhav out of the day's normal range for that jins (±15% of day's average, configurable) shows a warning, not a block.
- Acceptance: boli of 20 dheris entered in under 5 minutes using keyboard only.

### 5.4 Tulai — weighing (P0)

- Two entry modes, chosen per jins: total weight (gross kg + number of bags) or bag-wise (each bag's weight, Enter-to-next).
- Katauti: bag tare (kg/bag × bags), nami (moisture %), mitti/dust (kg or %) — each optional, defaults from jins master, editable per dheri.
- Net weight = gross − katauti, shown in quintal-kilo format (e.g., 52 qtl 35 kg) and stored in kg.
- Acceptance: net weight and sale value appear instantly as weights are typed; totals match a manual calculation to the rupee.

### 5.5 Kisan Parchi — farmer sale voucher (P0)

One parchi per kisan per day (combining all his dheris) or one per dheri — firm setting.

- Shows: parchi no., date, kisan details, each dheri (jins, bags, net weight, bhav, rakam), kisan-side kharcha lines from the rate master, peshgi recovered (if the munim chooses), net payable.
- Posting: kisan khata jama (net sale value after his kharcha); charges to their payable or income accounts.
- Print A4 bilingual; send the same as SMS/WhatsApp text (P1).
- Edit after print allowed only for malik / munim with reason; radd keeps the number and prints 'रद्द / CANCELLED'.

### 5.6 Vyapari Bill — buyer bill (P0)

One bill per vyapari per day (all his dheris) or per dheri — firm setting.

- Shows: bill no., date, vyapari details with licence no., each line (kisan name optional, jins, bags, net weight, bhav, rakam), vyapari-side kharcha (arhat, tulai, mandi shulk, krishak kalyan shulk, palledari, bardana, dhanka … per rate master), total payable, due date from credit days.
- Posting: vyapari khata naam (bill total); commission to arhat income; mandi shulk and fees to payable accounts (if the firm collects them) or shown only (if the vyapari pays the samiti directly) — setting per charge.
- Acceptance: bill total = sum of lines + charges, rounded per firm rule; the posting balances (jama = naam) every time.

### 5.7 Jama-Naam — receipts and payments (P0)

- Receipt from vyapari: amount, mode (nakad cash / cheque / NEFT-RTGS / UPI), reference/UTR, bank, against which bills (auto oldest-first or picked), TDS deducted by vyapari (194Q, 194H) recorded separately.
- Payment to kisan: amount, mode, reference; shows his current balance and pending parchis.
- Peshgi (advance) to kisan: amount, mode, purpose, byaj rate (default from party).
- Kharcha payments: palledari, bijli, kiraya, salary, mandi samiti fee deposit.
- Contra: cash to bank, bank to cash, bank to bank.
- Cash payment above a configurable limit shows a warning (limit and exceptions to be set with the firm's CA).
- Every voucher prints a raseed (receipt) on demand.

### 5.8 Rokad and Bank (P0)

- Rokad bahi: daily opening, all cash jama and naam, closing; physical cash count field with difference shown.
- Bank book per account; bank statement import (CSV/Excel) with match-and-tick reconciliation (P1).

### 5.9 Khata — ledgers (P0)

- Any party's khata for a date range: opening, each entry (date, voucher type, number, narration, jama, naam), running balance with side, closing.
- Toggle 'byaj sahit' to show interest accrued to date.
- Drill down from any line to its parchi/bill/voucher.
- Print A4 and share as PDF / WhatsApp (P1).

### 5.10 Peshgi and Byaj — advances and interest (P0)

- Byaj rule per party: rate (% per month, e.g. 1.00 = ₹1 per ₹100 per month), method (simple daily-product / monthly / compound at year end), grace days, applies to naam balance only.
- Byaj run: for a date range and selected parties, the system calculates interest on daily balances, shows a preview, and posts journal entries on approval.
- Vyapari overdue byaj: on balances beyond credit days, optional.
- Acceptance: byaj on a sample khata matches a hand calculation by daily product to the rupee.

### 5.11 Hisab — kisan settlement (P1)

- Season statement per kisan: all peshgi, byaj, crop sales (parchis), payments, closing balance; signed copy printed on A4.
- Carry forward closing balance to the next season or financial year.

### 5.12 Sarkari Kharid — govt procurement lots (P1)

- Dheri flagged as sarkari with agency (FCI, Rajfed, Tilam Sangh, etc.), MSP bhav, and arhat per quintal (e.g., wheat ₹45.67/qtl Rajasthan from RMS 2026-27) instead of %.
- Payment to kisan is direct from government: the parchi records the sale; kisan khata is not credited with the crop value unless the firm chooses; agency khata is naam for arhat + labour receivable.
- Report: lots, quintals, arhat and labour receivable by agency, received vs pending.

### 5.13 Nakal and Din Band — day book and day close (P0)

- Nakal: every entry of the day in time order, with totals of parchis, bills, cash and bank; printable.
- Din Band: munim or malik closes the day after checking rokad; closed days are read-only; malik can reopen with a reason (audit logged).

### 5.14 Mandi Shulk register (P0)

- Jins-wise and vyapari-wise sales, mandi shulk and krishak kalyan shulk for any period, in the samiti's return format; mark returns as filed with challan no. and date.

## 6. Kharcha aur tax engine (P0)

Every charge, fee and tax is a row in one master, Kharcha / Tax Master, that the malik can add, edit, deactivate and reorder — nothing is hard-coded. Parchi and bill totals are always calculated from this master; a rate change applies only from its effective date and never alters a printed parchi or bill.

**Fields of one kharcha line**

| Field | Options / example |
| --- | --- |
| Code, name (Hindi + English) | ARHAT — आढ़त / Commission |
| Kind | Kharcha (charge) · Shulk / Tax (statutory) · Katauti (weight or value cut) |
| Basis | % of rakam · ₹ per quintal · ₹ per bag · ₹ fixed per parchi/bill · % of another kharcha line |
| Rate | Number with up to 4 decimals; rate history with effective-from and effective-to dates |
| Paid by (kisan / vyapari) | Kisan (deducted on parchi) · Vyapari (added on bill) · Split (e.g., 50:50) |
| Applies to | All jins or selected jins; sale type: private, sarkari, or both; vyapari override allowed (Y/N) |
| Posts to | Income account (e.g., Arhat Aamdani) · Payable account (e.g., Mandi Samiti Payable, Palledar Khata) · Show only (printed, not posted) |
| Order (kram) | Sequence of calculation and printing |
| Rounding | None · nearest ₹1 · nearest 10 paise · up to ₹1 |
| Print | Show on parchi (Y/N) · show on bill (Y/N) · print label (Hindi / English) |
| Status | Active / Inactive |

**What the malik can do**

- **Add** a new line (e.g., a new cess) — available from its effective date.
- **Modify rate** — creates a new rate version from a chosen date; the old rate stays in history for past entries.
- **Delete** — makes the line inactive from a date; it disappears from new parchis and bills but past ones stay untouched. Hard delete only if never used.
- **Override per party** — e.g., a big vyapari with arhat 1.75% instead of 2%, with effective dates.
- **Test** — enter a sample dheri (jins, bags, weight, bhav) and see the parchi and bill totals before saving a change.
- Every change is audit-logged (who, when, old rate, new rate).

**Starting presets for Hanumangarh Town** — the firm must confirm each rate and payer before go-live.

| Line | Basis | Starting rate | Default paid by | Source / status |
| --- | --- | --- | --- | --- |
| Arhat / dami | % of rakam | 2.00% | Vyapari | Hanumangarh Town listed at 2% ([AGMARKNET profile](https://www.bharatkheti.com/mandi/rajasthan/hanumangarh/hanumangarh-town)) |
| Mandi shulk | % of rakam, by jins group | 1.60% / 1.00% / 0.50% | Vyapari | Hanumangarh samiti listing ([profile](<https://bharatkheti.com/mandi/rajasthan/hanumangarh/hanumangarh(urlivas)>)) |
| Krishak kalyan shulk | % of rakam | Blank — enter from latest notification | Vyapari | Confirm with samiti |
| Tulai | % of rakam or ₹/qtl | 0.25% | Vyapari | Nearby Suratgarh lists 0.25 per ₹100 ([profile](https://www.bharatkheti.com/mandi/rajasthan/hanumangarh/suratgarh)); confirm |
| Jharai | ₹ per quintal | ₹0.50 | Kisan | Suratgarh listing; confirm |
| Hammali / palledari | ₹ per bag or % | Blank | Firm to set | Confirm |
| Bharai, silai | ₹ per bag | Blank | Vyapari | Confirm |
| Bardana | ₹ per bag | Blank | Vyapari | Confirm |
| Dhanka | % of rakam | 0.50% | Firm to set | Sri Ganganagar listing; confirm meaning and payer |
| Arhat (sarkari kharid) | ₹ per quintal | Wheat ₹45.67 (Rajasthan, RMS 2026-27) | Agency | Centre's revised rates; paddy rate per notification |

**Calculation order**

1. Rakam (sale value) = net weight in quintal × bhav.
2. Katauti lines that cut weight are applied before step 1; katauti lines that cut value come right after it.
3. Kharcha lines are calculated in kram order on rakam, or on the line they reference.
4. Each line is rounded per its rule; totals are rounded per firm setting.
5. Kisan parchi net = rakam − kisan-side lines − peshgi recovered (optional).
6. Vyapari bill total = rakam + vyapari-side lines.

```latex
\text{Bill total} = W_{net} \cdot B + \sum_{i \in \text{vyapari}} c_i \qquad \text{Parchi net} = W_{net} \cdot B - \sum_{j \in \text{kisan}} c_j - P
```

Here W net = net weight in quintal, B = bhav per quintal, c = each kharcha line, P = peshgi recovered on this parchi.

**Worked example** (illustrative; labour lines left out): 50 qtl wheat at ₹2,450/qtl.

| Line | Calculation | Parchi (kisan) | Bill (vyapari) |
| --- | --- | --- | --- |
| Rakam | 50 × 2,450 | 1,22,500 | 1,22,500 |
| Arhat 2% | 1,22,500 × 2% | — | + 2,450 |
| Tulai 0.25% | 1,22,500 × 0.25% = 306.25 → 306 | — | + 306 |
| Mandi shulk 1.60% | 1,22,500 × 1.6% | — | + 1,960 |
| Jharai ₹0.50/qtl | 50 × 0.50 | − 25 | — |
| **Total** |  | **1,22,475** | **1,27,216** |

**Taxes outside the parchi/bill**

- TDS deducted by vyapari (194H on arhat, 194Q on purchase value) is entered at the time of receipt and tracked per vyapari for 26AS reconciliation; it is not a kharcha line.
- GST: commission on agri produce is exempt, so v1 sets no GST lines; the engine supports a GST line type (rate per jins via HSN) for later own-trading.

## 7. Reports (Report / रिपोर्ट)

All reports take a date range and filters (jins, party, gaon, user), show on screen first, print on A4, and export to Excel and PDF.

| Report | What it shows | Who uses it | Priority |
| --- | --- | --- | --- |
| Aaj ka saar (today's summary) | Aamad, dheris sold, quintals and rakam by jins, parchis and bills made, cash and bank in/out, pending boli/tulai | Malik, munim | P0 |
| Nakal (day book) | Every voucher in time order with totals | Munim, CA | P0 |
| Rokad bahi | Cash book with opening/closing | Munim | P0 |
| Bank bahi | Per bank account | Munim, CA | P0 |
| Khata (ledger) | Any party, with or without byaj | All | P0 |
| Lena-dena (outstanding) | Vyapari receivable with ageing (0–7, 8–15, 16–30, 30+ days); kisan payable | Malik, munim | P0 |
| Parchi register | All kisan parchis with totals, radd marked | Munim, CA | P0 |
| Bill register | All vyapari bills with totals, radd marked | Munim, CA | P0 |
| Jins-wise bikri | Quintals, average bhav, rakam per jins per day/month | Malik | P0 |
| Arhat aamdani (commission earned) | By vyapari, jins, month | Malik, CA | P0 |
| Mandi shulk register | Fee and krishak kalyan shulk due, by jins and vyapari, filed or not | Munim | P0 |
| Kharcha-wise report | Each kharcha line collected, paid, balance (e.g., palledari collected vs paid) | Munim | P1 |
| Byaj report | Interest accrued per party, posted and pending | Malik | P1 |
| Kisan hisab | Season statement for each kisan | Munim | P1 |
| Sarkari kharid report | Lots, quintals, arhat and labour receivable per agency | Munim | P1 |
| TDS / 26AS milan | Vyapari-wise TDS (194H, 194Q) recorded vs 26AS import; mismatches | CA | P1 |
| Trial balance, P&L, balance sheet | Standard financial statements | CA | P1 |
| Audit log | Edits, radd, rate changes, day reopen | Malik | P0 |

## 8. Printing on A4

Every print is an A4 portrait page generated as PDF from the browser, so it works on any A4 laser or inkjet printer without drivers or special setup.

**Print rules**

- Language per print: Hindi, English, or both (bilingual labels like 'तुलाई / Tulai'); default set in firm settings, changeable at print time.
- Font: Noto Sans Devanagari for Hindi, Noto Sans for English, embedded in the PDF so Hindi prints correctly everywhere.
- Amounts in Indian format (1,22,500.00) and in words in Hindi or English (एक लाख बाईस हज़ार पांच सौ रुपये).
- Weight in quintal and kg (52 क्विं. 35 कि.ग्रा.).
- Each print carries firm name, licence no., address, phone, parchi/bill no., date, page x of y, 'Original' or 'Nakal (duplicate)' mark, and a signature line.
- Layout options for kisan parchi: full A4, or two parchis per A4 (top/bottom halves, A5 size) to save paper in season.
- Reprint keeps the same number and is marked 'Nakal'.

**Print formats**

| Format | Contents | Copies |
| --- | --- | --- |
| Kisan Parchi (J) | Kisan, gaon, mobile; dheri lines (jins, bori, net wt, bhav, rakam); kisan-side kharcha; peshgi recovered; net payable in figures and words | Kisan copy + office nakal |
| Vyapari Bill (I) | Vyapari, licence no.; lines; vyapari-side kharcha; total; due date; bank details for payment | Vyapari copy + office nakal |
| Raseed (receipt) | Jama or naam voucher with mode and reference | 1 |
| Khata statement | Party ledger for a period, with closing and byaj | 1 |
| Kisan hisab | Season settlement with signature lines for kisan and firm | 2 |
| Nakal, rokad, registers | Report layouts with running page totals ('aage le jaya / pichhla jod') | 1 |

Print templates are fixed layouts in v1 with logo and footer text editable; a template editor is P2.

## 9. UX rules and screens

The app should feel like the munim's bahi, only faster: familiar words, one screen per job, and the keyboard never has to leave the hand during season.

**UX rules**

1. **Mandi words everywhere.** Labels from the shabdavali (section 3); no accounting jargon like 'voucher', 'debit note' or 'ledger posting' on screen.
2. **Hindi first, one tap to English.** Language toggle at top right; choice remembered per user. Party names stored in both scripts.
3. **Type in English, find in Hindi.** Party search accepts Roman typing ('ramesh' finds 'रमेश') and matches gaon and mobile.
4. **Keyboard-fast.** Enter moves to the next field, Esc goes back, F2 party search, F3 jins, Ctrl+S save, Ctrl+P print, Alt+N new entry. Every P0 screen is usable without a mouse.
5. **One dheri screen in season.** A combined Dheri Entry screen covers aamad, boli and tulai in one form, then 'Save + Print Parchi'.
6. **Big and clear.** Minimum 16 px text, 44 px tap targets, high contrast; jama in green, naam in red, balances always show the side (जमा / नाम).
7. **Show the money live.** Rakam, each kharcha line, parchi net and bill total update as the operator types.
8. **Plain messages.** Errors say what to do in the user's language ('भाव डालें' — enter bhav), never codes.
9. **No accidental loss.** Unsaved form warning; nothing is ever deleted — radd with reason instead; only radd asks for confirmation.
10. **Date and year always visible.** Working date (changeable for back-entry by munim), financial year, and logged-in user in the header.
11. **Desktop first.** Designed for a shop PC at 1366×768; works on a tablet; a phone view for the malik to check balances and today's summary (P1).

**Screen list**

| Menu (Hindi / English) | Screen | Purpose | Priority |
| --- | --- | --- | --- |
| मुख्य पृष्ठ / Home | Aaj ka saar | Today's totals, pending boli/tulai, quick tiles | P0 |
| ढेरी / Dheri | Dheri Entry | Aamad + boli + tulai in one form, save and print parchi | P0 |
| आमद / Aamad | Aamad list | Today's arrivals and their status | P0 |
| बोली / Boli | Boli sheet | Fast grid entry of vyapari and bhav for many dheris | P0 |
| तुलाई / Tulai | Tulai sheet | Weights, bags and katauti per dheri | P0 |
| पर्ची / Parchi | Kisan parchi list and view | Make, print, reprint, radd | P0 |
| बिल / Bill | Vyapari bill list and view | Make, print, reprint, radd | P0 |
| जमा / Jama | Receipt entry | Money received from vyapari or others, TDS | P0 |
| नाम / Naam | Payment entry | Payments to kisan, peshgi, kharcha | P0 |
| खाता / Khata | Party ledger | Any party's account with byaj toggle | P0 |
| रोकड़ / Rokad | Cash book | Daily cash, physical count | P0 |
| नकल / Nakal | Day book and din band | Day's entries; close the day | P0 |
| ब्याज / Byaj | Byaj run | Calculate, preview and post interest | P0 |
| हिसाब / Hisab | Kisan settlement | Season statement | P1 |
| सरकारी खरीद / Sarkari | Govt lots | MSP lots and agency receivable | P1 |
| रिपोर्ट / Report | Report list | All reports in section 7 | P0 |
| मास्टर / Master | Party, jins, kharcha/tax, bank | Masters and the rate master | P0 |
| सेटिंग / Settings | Firm, print, number series, users, backup, shabd | Admin | P0 |

**Dheri Entry screen — field order** (Enter moves down the list): kisan → jins → bori → vyapari → bhav → gross weight (or bag-wise) → katauti → \[live panel shows rakam, kharcha, parchi net, bill total\] → Save + Print.

## 10. Data model (PostgreSQL)

The books are double-entry and append-only: every parchi, bill, jama and naam creates one voucher whose ledger entries always balance, and nothing posted is ever updated in place — corrections are reversals. Each parchi and bill stores a snapshot of the rates it used, so changing the rate master never changes history.

| Table | Key columns | Notes |
| --- | --- | --- |
| firm\_settings | name, licence\_no, address, pan, gstin, logo, default\_lang, rounding\_rule | One row (single firm) |
| users | name, mobile, password\_hash, role, lang, active | Roles: malik, munim, operator, ca |
| financial\_years | start\_date, end\_date, is\_locked | Apr–Mar |
| account\_groups | name\_hi, name\_en, nature (asset/liability/income/expense), parent\_id | Kisan, Vyapari, Bank, Cash, Arhat Aamdani, Mandi Samiti Payable… |
| accounts (khata) | group\_id, party\_type, name\_hi, name\_en, father\_name, village, mobile, pan, bank\_ac, ifsc, gstin, licence\_no, opening\_amount, opening\_side, credit\_days, active | Parties and all ledger heads in one table |
| interest\_rules | account\_id, rate\_pm, method, grace\_days, effective\_from | Byaj per party |
| commodities (jins) | name\_hi, name\_en, hsn, fee\_group, bag\_kg, default\_tare\_kg, msp\_rate, active |  |
| charge\_heads | code, name\_hi, name\_en, kind, basis, payer, split\_pct, post\_account\_id, seq, rounding, on\_parchi, on\_bill, active\_from, active\_to | The kharcha/tax master |
| charge\_rates | charge\_head\_id, commodity\_id?, account\_id?, sale\_type, rate, effective\_from, effective\_to | Rate history and party overrides |
| arrivals (aamad) | arrival\_no, date, kisan\_id, gate\_entry\_no, vehicle\_no, remarks |  |
| lots (dheri) | arrival\_id, kisan\_id, commodity\_id, bags, quality\_note, status | Status: aamad → boli → tulai → parchi |
| lot\_sales | lot\_id, vyapari\_id, sale\_type, agency\_id?, bhav, bags, gross\_kg, tare\_kg, moisture\_pct, dust\_kg, net\_kg, amount | One row per vyapari share of a dheri |
| lot\_bag\_weights | lot\_sale\_id, bag\_no, kg | Only in bag-wise mode |
| parchis / parchi\_lines | parchi\_no, date, fy\_id, kisan\_id, gross\_amount, deductions, peshgi\_recovered, net\_amount, status, print\_count · lines → lot\_sale\_id | Kisan sale voucher |
| bills / bill\_lines | bill\_no, date, fy\_id, vyapari\_id, amount, charges, total, due\_date, status, print\_count · lines → lot\_sale\_id | Vyapari bill |
| document\_charges | doc\_type, doc\_id, charge\_head\_id, basis\_value, rate\_used, amount, payer | Snapshot of every kharcha line on each parchi/bill |
| vouchers | type (parchi, bill, jama, naam, contra, journal, byaj, reversal), voucher\_no, date, fy\_id, narration, mode, ref\_no, status, created\_by, reverses\_id? | Header for every posting |
| ledger\_entries | voucher\_id, account\_id, date, debit, credit | Immutable; sum of debit = sum of credit per voucher (enforced by deferred trigger) |
| bill\_allocations | receipt\_voucher\_id, bill\_id, amount | Which receipt settled which bill |
| tds\_entries | voucher\_id, vyapari\_id, section (194H/194Q), amount, quarter | For 26AS milan |
| interest\_runs / interest\_lines | period\_from, period\_to, posted\_voucher\_id · account\_id, product, rate, amount | Byaj calculation trail |
| day\_closes | date, closed\_by, closed\_at, reopened\_by, reopen\_reason | Din band |
| number\_series | doc\_type, fy\_id, prefix, next\_no | Gapless numbers per year |
| custom\_labels | key, text\_hi, text\_en | Firm's own words (shabd) |
| audit\_log | table\_name, row\_id, action, old\_data jsonb, new\_data jsonb, reason, user\_id, at | Every edit, radd, rate change |

**Data rules**

- Money in numeric(14,2); rates in numeric(10,4); weights in numeric(12,2) kg. No floating-point anywhere.
- Parchi and bill numbers are gapless per financial year, assigned inside the posting transaction; radd keeps the number.
- Posting a parchi or bill (document + document\_charges + voucher + ledger\_entries) is one database transaction: all or nothing.
- Balances are computed from ledger\_entries; a materialised daily balance table can be added for speed if needed (P1).
- Soft delete only (active flags, status = radd); hard delete is blocked by foreign keys for anything used.

## 11. Technical architecture

One Next.js application talks to one PostgreSQL database; all money calculations run on the server in a single shared module, so the screen preview, the printed PDF and the posted entries can never disagree.

**Stack**

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript | Requested; server actions keep posting logic on the server |
| Database | PostgreSQL 16 | Requested; numeric types, transactions, triggers, pg\_trgm for search |
| ORM / queries | Drizzle ORM, raw SQL for reports | Typed schema close to SQL; reports need hand-tuned queries |
| UI | Tailwind CSS + shadcn/ui, TanStack Table for grids | Fast keyboard-friendly forms and editable grids |
| Forms and validation | react-hook-form + zod (shared schemas on client and server) | Same rules in browser and server |
| Language | next-intl with hi and en message files; custom\_labels table overrides | Hindi/English toggle, firm's own words |
| Money maths | decimal.js in one calc module (rakam, kharcha, rounding, byaj) | No floating-point errors; unit-tested |
| Auth | Auth.js credentials (mobile + password), role checks in every server action | Simple login for shop staff |
| PDF / print | HTML templates with A4 print CSS rendered to PDF by headless Chromium (Playwright) on the server; Noto Devanagari fonts embedded | Identical Hindi output on any printer |
| Excel export | ExcelJS | CA needs Excel |
| SMS / WhatsApp (P1) | Provider API (e.g., MSG91 or WhatsApp Business API) | Parchi and khata to kisan |
| Jobs | pg-boss (queue in Postgres) | Byaj runs, backups, PDF batches without extra infra |

**Deployment options** — to decide with the firm.

|  | A. Shop PC server (recommended) | B. Cloud server |
| --- | --- | --- |
| Setup | Docker Compose (Next.js + Postgres) on one shop PC; other PCs/tablets use it over the shop LAN | VPS in Mumbai region (e.g., AWS Lightsail / EC2) with managed or self-run Postgres |
| Works without internet | Yes | No |
| Malik's phone access | Through a secure tunnel when internet is up (P1) | Anywhere |
| Backup | Hourly encrypted dump to cloud storage (S3) + 'Backup to pen drive' button | Automated snapshots + daily dump |
| Risk | PC failure — needs UPS and the cloud backup | Mandi internet outages stop work in season |

**Backup and restore**

- pg\_dump every hour during working hours and nightly full dump; 30 daily + 12 monthly copies kept; encrypted.
- Malik sees 'last backup' time on the home screen; a red warning if older than 24 hours.
- Restore tested once a month on a spare database (documented checklist).

**Security**

- Every server action checks the user's role; the browser never decides permissions.
- Passwords hashed (bcrypt/argon2); session timeout after 30 minutes idle; lock after 5 wrong attempts.
- HTTPS on cloud; on LAN, a local certificate or LAN-only access.
- Only last 4 digits of Aadhaar stored; bank details visible to malik and munim only.

## 12. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Speed | Screens open in under 1 second on the shop LAN; party search results in under 300 ms; parchi PDF ready in under 3 seconds |
| Volume | 1,000 dheris a day in peak season and 5 years of data without slowdown |
| Users | Up to 10 users at once on the same data |
| Accuracy | All totals to the paisa; every voucher balances; calc module covered by unit tests on the worked examples |
| Reliability | No data loss on power cut mid-entry (transactions); UPS recommended for the server PC |
| Audit | Every create, edit, radd, rate change, reopen logged with user and time; log cannot be edited from the app |
| Language | 100% of screens and prints available in Hindi and English |
| Accessibility | 16 px minimum text, high contrast, full keyboard use on P0 screens |
| Browsers | Latest Chrome and Edge on Windows; Chrome on Android tablet |
| Year end | Close financial year, carry forward balances, lock old year (malik can unlock with reason) |
| Data export | Every report to Excel and PDF; full data export to CSV on request |

## 13. Release plan

Ship in three phases so the firm can run one real season on Phase 1 while the books are still checked against the paper bahi. Durations are working estimates for one full-stack developer plus a tester and should be re-planned once the open questions are answered.

| Phase | Scope | Exit criteria | Estimate |
| --- | --- | --- | --- |
| 1. Season-ready core | Masters, kharcha/tax master with presets, Dheri Entry (aamad + boli + tulai), kisan parchi, vyapari bill, jama-naam, rokad, bank, khata, nakal, din band, byaj run, A4 bilingual prints, core reports, users and roles, backup, audit log | One week of real sales entered in parallel with the paper bahi; every parchi, bill and closing balance matches to the rupee | 8–10 weeks |
| 2. Settlement and compliance | Kisan hisab, sarkari kharid lots, TDS and 26AS milan, mandi shulk return format, kharcha-wise report, trial balance, P&L, balance sheet, year-end close, bank statement import, malik phone view | CA signs off year-end statements produced by the app | 5–6 weeks |
| 3. Reach and polish | SMS/WhatsApp parchi and khata to kisan, payment reminders to vyapari, template editor, e-NAM / e-mandi export files, scale integration study | Kisans receive parchi on phone for every sale in a week | 4–6 weeks |

**Go-live checklist (end of Phase 1)**

- [ ] All kharcha and tax rates confirmed by the malik and entered with effective dates
- [ ] Opening balances of every kisan, vyapari, bank and cash entered and matched to the bahi
- [ ] Parchi and bill A4 prints approved by the malik in Hindi and English
- [ ] Staff trained: one session for operators, one for the munim
- [ ] Backup to cloud and pen drive tested, and one restore done

## 14. Assumptions and open questions

**Assumptions made in this PRD**

- The firm works only as kachi arhat in v1; pakki arhat and own trading come later.
- Rajasthan mandi shulk groups 1.60% / 1.00% / 0.50% apply at Hanumangarh Town; arhat is 2% by default.
- The vyapari pays arhat, tulai and mandi shulk; the kisan pays jharai — editable in the master.
- One parchi per kisan per day and one bill per vyapari per day, by default.
- Shop PC server deployment, A4 laser printer, Windows PCs with Chrome.

**Open questions for the firm**

- [ ] Exact meaning, spelling and payer of 'dhanka' in this firm's practice.
- [ ] Current rates and payers for tulai, jharai, hammali/palledari, bharai, silai, bardana and krishak kalyan shulk at Hanumangarh Town.
- [ ] Does the firm collect mandi shulk from vyaparis and deposit it, or does each vyapari pay the samiti directly?
- [ ] Is commission ever charged to the kisan instead of (or as well as) the vyapari?
- [ ] Katauti practice per jins: tare per bag, nami, dust — fixed or agreed per dheri?
- [ ] Byaj on peshgi: rate per month, simple or compound, posted monthly or at hisab only?
- [ ] Should peshgi be recovered automatically from every parchi, or only when the munim chooses?
- [ ] Which sarkari agencies and jins the firm handles, and how labour charges are claimed from them.
- [ ] Samples of the current parchi, bill and bahi pages, to copy their layout and numbering.
- [ ] Number of users and PCs; internet reliability at the shop (decides deployment A or B).
- [ ] Does the CA need Tally export in addition to Excel?
