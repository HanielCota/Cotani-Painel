import Image from "next/image";

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Barra do topo só no celular, para abrir o menu. No computador, recolher e
 * notificações ficam na própria sidebar.
 */
export function DashboardTopbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Image src="/images/cotani-favicon.png" alt="" width={28} height={28} className="size-7" />
      <span className="text-base font-bold tracking-tight">Cotani</span>
    </header>
  );
}
