import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** Barra fixa do painel: menu, notificações e tema ficam sempre no mesmo lugar. */
export function DashboardTopbar({ showNotifications = true }: { showNotifications?: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="mr-1 h-5 data-vertical:self-center" />
      <div className="flex-1" />
      {showNotifications ? <NotificationBell /> : null}
      <ThemeToggle />
    </header>
  );
}
