import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { getPlatformAdminContext } from "@/server/platform-admin";
import { signOut } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: { default: "Administração", template: "%s | Gestão Cotani" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdminContext();
  if (!admin) notFound();

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ShieldCheckIcon className="size-5" />
              </span>
              Gestão Cotani
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Ir para o painel</Link>
              <form action={signOut}><button type="submit" className="rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Sair</button></form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
