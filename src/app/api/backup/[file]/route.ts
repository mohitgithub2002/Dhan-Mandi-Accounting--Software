import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { currentActor } from "@/lib/server/auth";
import { BACKUP_NAME, backupDir } from "@/lib/server/backup";

/** 'Backup to pen drive': malik downloads a dump file (PRD §11). */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const actor = await currentActor();
  if (!actor || !can(actor.role, "admin")) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const { file } = await params;
  if (!BACKUP_NAME.test(file)) return NextResponse.json({ error: "bad name" }, { status: 400 });
  const full = path.join(backupDir(), file);
  const s = await stat(full).catch(() => null);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(s.size), "Content-Disposition": `attachment; filename="${file}"` },
  });
}
