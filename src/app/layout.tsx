import type { Metadata } from "next";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "मंडी खाता · Mandi Khata",
  description: "Kachi arhat accounting — Hanumangarh Town",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
