#!/usr/bin/env bash
# Hourly backup during working hours + nightly; keeps 30 daily and 12 monthly copies (PRD §11).
# Usage (cron):  0 8-20 * * *  cd /app && bash scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsx scripts/backup.ts
DIR="${BACKUP_DIR:-./backups}"
# Keep: newest file of each of the last 30 days and of the last 12 months; delete the rest.
python3 - "$DIR" <<'PY'
import os, re, sys
d = sys.argv[1]
files = sorted([f for f in os.listdir(d) if re.match(r"^mandi_\d{8}_\d{6}\.dump(\.enc)?$", f)], reverse=True)
keep, days, months = set(), [], []
for f in files:
    day, month = f[6:14], f[6:12]
    if day not in days and len(days) < 30:
        days.append(day); keep.add(f)
    if month not in months and len(months) < 12:
        months.append(month); keep.add(f)
for f in files[:24]:
    keep.add(f)  # today's hourly copies
for f in files:
    if f not in keep:
        os.remove(os.path.join(d, f))
PY
