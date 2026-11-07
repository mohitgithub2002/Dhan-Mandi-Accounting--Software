import "server-only";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { Transform } from "node:stream";
import type { DbOrTx } from "@/db";
import { backupsLog } from "@/db/schema";
import { audit, type Actor } from "./core";
import { fail } from "./errors";

export const backupDir = () => path.resolve(process.env.BACKUP_DIR || "./backups");
export const BACKUP_NAME = /^mandi_\d{8}_\d{6}\.dump(\.enc)?$/;

/**
 * pg_dump (custom format) of the whole database into BACKUP_DIR (PRD §11).
 * With BACKUP_PASSPHRASE set, the file is AES-256-CBC encrypted: header "MKBK1" +
 * 16-byte salt + 16-byte IV, key = SHA-256(passphrase + salt). Decrypt with
 * `npx tsx scripts/decrypt-backup.ts <file>` — restore steps in docs/OPERATIONS.md.
 */
export async function runBackup(tx: DbOrTx, actor: Actor | null, source: "manual" | "scheduled") {
  const url = process.env.DATABASE_URL;
  if (!url) fail("डेटाबेस सेट नहीं", "DATABASE_URL is not set");
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  const pass = process.env.BACKUP_PASSPHRASE;
  const file = `mandi_${stamp}.dump${pass ? ".enc" : ""}`;
  const full = path.join(dir, file);

  const child = spawn(process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--no-owner", `--dbname=${url}`], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += String(c)));
  const exited = new Promise<number>((res) => child.on("close", (code) => res(code ?? 1)));
  child.on("error", (e) => (stderr += e.message));

  if (pass) {
    const salt = randomBytes(16);
    const key = createHash("sha256").update(pass).update(salt).digest();
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    let first = true;
    const header = new Transform({
      transform(chunk, _enc, cb) {
        if (first) {
          first = false;
          this.push(Buffer.concat([Buffer.from("MKBK1"), salt, iv]));
        }
        cb(null, chunk);
      },
    });
    await pipeline(child.stdout, cipher, header, createWriteStream(full));
  } else {
    await pipeline(child.stdout, createWriteStream(full));
  }
  const code = await exited;
  if (code !== 0) fail(`बैकअप नहीं हुआ: ${stderr.slice(0, 200)}`, `Backup failed: ${stderr.slice(0, 200)}`);
  const size = (await stat(full)).size;
  await tx.insert(backupsLog).values({ file, sizeBytes: size, source, userId: actor?.id ?? null });
  if (actor) await audit(tx, actor, { table: "backups_log", rowId: file, action: "backup" });
  return { file, size };
}

export async function listBackupFiles() {
  try {
    const dir = backupDir();
    const names = (await readdir(dir)).filter((n) => BACKUP_NAME.test(n)).sort().reverse();
    return Promise.all(names.slice(0, 60).map(async (n) => ({ name: n, size: (await stat(path.join(dir, n))).size })));
  } catch {
    return [];
  }
}
