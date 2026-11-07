import { requirePage } from "@/lib/server/auth";
import "./print.css";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requirePage();
  return <div className="print-root">{children}</div>;
}
