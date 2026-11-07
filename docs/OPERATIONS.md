# Operations — shop server, backups, go-live

## 1. Install on the shop PC (PRD §11, option A)

1. Install Docker Desktop (Windows) or Docker Engine (Linux) on the server PC; put
   it on a UPS.
2. Copy this repository to the PC and create `.env`:

   ```env
   DB_PASSWORD=<long random password>
   AUTH_SECRET=<openssl rand -hex 32>
   BACKUP_PASSPHRASE=<passphrase for encrypted backups — write it down safely>
   SEED_ADMIN_MOBILE=<malik mobile>
   SEED_ADMIN_PASSWORD=<first password>
   ```

3. Start: `docker compose up -d --build`. The app migrates the database on start.
4. First time only: `docker compose exec app npx tsx scripts/seed.ts`
5. Other PCs and tablets on the shop LAN open `http://<server-ip>:3000` in Chrome or
   Edge. Keep the port closed to the internet (LAN only), or put HTTPS in front.

## 2. Backups (PRD §11)

- The `backup` service writes a `pg_dump` every hour 08:00–21:00 and at 23:30 into
  `./backups`, keeping the newest file of each of the last 30 days and 12 months.
- With `BACKUP_PASSPHRASE` set, files are encrypted (`.dump.enc`).
- **Cloud copy:** sync the `./backups` folder to cloud storage (e.g. `rclone sync
  ./backups remote:mandi-backups` from Task Scheduler / cron).
- **Pen drive:** Settings → Backup → *Back up now*, then *Download*.
- The home screen shows the last backup time to the malik and turns red after 24 hours.

### Restore (test once a month on a spare database)

```bash
# 1. decrypt if needed
BACKUP_PASSPHRASE=... npx tsx scripts/decrypt-backup.ts backups/mandi_20261107_120000.dump.enc
# 2. restore into an empty database
createdb mandi_restore_test
pg_restore --no-owner --dbname=postgres://.../mandi_restore_test backups/mandi_20261107_120000.dump
# 3. point DATABASE_URL at it, start the app, check the trial balance and a few khatas
```

Checklist: trial balance totals match · last day's nakal present · parchi/bill
counts match the registers · a kisan and a vyapari khata match the paper bahi.

## 3. Go-live checklist (PRD §13)

- [ ] Every kharcha and tax rate confirmed by the malik and entered with an effective
      date (Master → Kharcha / tax). Presets that must be confirmed: arhat 2%, tulai
      0.25%, jharai ₹0.50/qtl, mandi shulk 1.60 / 1.00 / 0.50% per jins, sarkari arhat
      wheat ₹45.67/qtl. Blank until entered: krishak kalyan shulk, hammali, bharai-silai,
      bardana. Dhanka 0.50% is seeded **inactive** — confirm meaning and payer first.
- [ ] Mandi shulk: *Payable* if the firm collects and deposits it, *Show only* if each
      vyapari pays the samiti directly.
- [ ] Opening balances of every kisan, vyapari, bank and cash entered (Master → Party)
      and matched to the bahi (Reports → Trial balance).
- [ ] Firm name, licence, address, logo and print language set (Settings).
- [ ] Parchi and bill A4 prints approved by the malik in Hindi and English.
- [ ] Users created with the right roles; default malik password changed.
- [ ] Backup to cloud and pen drive tested, and one restore done.
- [ ] Staff trained: one session for operators (Dheri Entry, Boli, Tulai, prints), one
      for the munim (jama-naam, khata, rokad, nakal, din band, byaj).

## 4. Daily routine

1. Operators: Dheri Entry (or Aamad → Boli → Tulai sheets), Save + Print parchi.
2. Munim: Bill → *Make bills* for the day; print bills.
3. Munim: Jama / Naam for money in and out; raseed on demand.
4. Munim: Rokad → enter the physical cash count; check the difference.
5. Munim: Nakal → check the day → **Din band**.

## 5. Year end

Reports → Trial balance as of 31 March; export to Excel for the CA. Settings →
Backup and years → *Lock year* once the CA signs off (malik can unlock with a reason).
