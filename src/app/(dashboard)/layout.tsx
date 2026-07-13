import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: {
    default: "Painel",
    template: "%s | Cotani",
  },
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  await auth.protect();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-muted/30">
        <DashboardHeader />
        <div className="flex flex-1 flex-col p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
