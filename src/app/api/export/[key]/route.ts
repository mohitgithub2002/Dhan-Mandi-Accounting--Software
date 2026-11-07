import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/permissions";
import { currentActor } from "@/lib/server/auth";
import { isIsoDate, todayIST } from "@/lib/dates";
import { reportByKey } from "@/lib/server/reports";

/** Excel export of any report (PRD §7: every report to Excel). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const actor = await currentActor();
  const { key } = await params;
  const def = reportByKey(key);
  if (!def?.run) return NextResponse.json({ error: "unknown report" }, { status: 404 });
  if (!actor || !can(actor.role, def.perm)) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const to = isIsoDate(q.get("to")) ? q.get("to")! : todayIST();
  const from = def.asOf ? to : isIsoDate(q.get("from")) ? q.get("from")! : to;
  const result = await def.run({ from, to, group: q.get("group") ?? undefined });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mandi Khata";
  const ws = wb.addWorksheet(def.en.slice(0, 30));
  ws.addRow([`${def.hi} / ${def.en}`]).font = { bold: true, size: 14 };
  ws.addRow([def.asOf ? `As of ${to}` : `${from} to ${to}`]);
  ws.addRow([]);
  const header = ws.addRow(result.columns.map((c) => `${c.hi} / ${c.en}${c.type === "kg" ? " (qtl)" : ""}`));
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  });
  for (const r of result.rows) {
    ws.addRow(
      result.columns.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined) return null;
        if (c.type === "money" || c.type === "num" || c.type === "rate") return Number(v);
        if (c.type === "kg") return Number(v) / 100;
        return String(v);
      }),
    );
  }
  const totalRow = ws.addRow(
    result.columns.map((c, i) => {
      if (i === 0) return "Total";
      if (!c.total) return null;
      const s = result.rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0);
      return c.type === "kg" ? s / 100 : s;
    }),
  );
  totalRow.font = { bold: true };
  result.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.type === "text" ? 28 : 16;
    if (c.type === "money") col.numFmt = "#,##,##0.00";
    if (c.type === "kg") col.numFmt = "0.00";
  });
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${key}_${from}_${to}.xlsx"`,
    },
  });
}
