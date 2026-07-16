import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { PaymentRequiredState } from "@/components/dashboard/payment-required-state";
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireActiveClinic } from "@/server/tenant";

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

  const clinic = await requireActiveClinic();

  if (clinic && !clinic.hasPaidOnce) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-muted/30">
          <DashboardHeader />
          <div className="flex flex-1 flex-col p-4 md:p-6 lg:p-8">
            <PaymentRequiredState barbershopName={clinic.name} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-muted/30">
        <DashboardHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
          {clinic ? <SubscriptionBanner status={clinic.subscriptionStatus} /> : null}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
