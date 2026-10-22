import type { Metadata } from "next";
import type { ReactNode } from "react";
import { resolveLocale } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProcureFlow · Enterprise Procurement Management",
    template: "%s | ProcureFlow",
  },
  description: "Internal purchase requisition, approval workflow & supply-chain management system",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await resolveLocale();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
