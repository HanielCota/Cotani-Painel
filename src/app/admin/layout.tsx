import { UserButton } from "@clerk/nextjs";
import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { getPlatformAdminContext } from "@/server/platform-admin";

export const metadata: Metadata = {
  title: { default: "Administração", template: "%s | Gestão Cotani" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdminContext();
  if (!admin) notFound();

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheckIcon className="size-5" />
              </span>
              Gestão Cotani
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Ir para o painel</Link>
              <UserButton />
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
