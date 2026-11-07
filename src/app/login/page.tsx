import { getFirm } from "@/lib/server/core";
import { db } from "@/db";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  let firmName = "मंडी खाता";
  try {
    const f = await getFirm(db);
    firmName = f.nameHi || f.nameEn || firmName;
  } catch {
    /* DB not ready yet — still show the form */
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-brand-100 bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-800">मंडी खाता</h1>
        <p className="mb-5 text-slate-600">{firmName} · Mandi Khata</p>
        <LoginForm next={sp.next ?? "/"} />
      </div>
    </main>
  );
}
