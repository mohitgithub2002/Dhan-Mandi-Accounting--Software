/** Scheduled backup (cron / compose sidecar): pg_dump into BACKUP_DIR and log it. */
import "dotenv/config";
import { createDb, setDb } from "../src/db";
import { runBackup } from "../src/lib/server/backup";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { client, db } = createDb(url);
setDb(db);
runBackup(db, null, "scheduled")
  .then((r) => console.log(`Backup written: ${r.file} (${r.size} bytes)`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
