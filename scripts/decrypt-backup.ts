/**
 * Decrypt a backup written with BACKUP_PASSPHRASE.
 *   BACKUP_PASSPHRASE=... npx tsx scripts/decrypt-backup.ts backups/mandi_20261107_120000.dump.enc
 * Writes the plain pg_dump file next to it (without .enc), ready for pg_restore.
 */
import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const pass = process.env.BACKUP_PASSPHRASE;
if (!file || !pass) {
  console.error("usage: BACKUP_PASSPHRASE=... npx tsx scripts/decrypt-backup.ts <file.dump.enc>");
  process.exit(1);
}
const buf = readFileSync(file);
if (buf.subarray(0, 5).toString() !== "MKBK1") throw new Error("Not a Mandi Khata encrypted backup");
const salt = buf.subarray(5, 21);
const iv = buf.subarray(21, 37);
const key = createHash("sha256").update(pass).update(salt).digest();
const d = createDecipheriv("aes-256-cbc", key, iv);
const out = Buffer.concat([d.update(buf.subarray(37)), d.final()]);
const target = file.replace(/\.enc$/, "");
writeFileSync(target, out);
console.log(`Decrypted → ${target}`);
