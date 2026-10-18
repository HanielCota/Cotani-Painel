import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { getPlatformAdminAccess } from "@/server/platform-admin";
import { signOut } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: { default: "Administração", template: "%s | Gestão Cotani" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getPlatformAdminAccess();
  if (access.status === "denied") notFound();
  if (access.status === "mfa-enrollment-required") redirect("/dashboard/minha-conta#seguranca");
  if (access.status === "mfa-challenge-required") redirect("/mfa?redirect=/admin");

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex min-h-10 items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Image src="/images/cotani-favicon.png" alt="" width={36} height={36} priority className="size-9" />
              Cotani
              <Badge variant="secondary">Gestão</Badge>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Ir para o painel</Link>
              <ThemeToggle />
              <form action={signOut}><Button type="submit" variant="ghost">Sair</Button></form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
