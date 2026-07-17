import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { PaymentRequiredState } from "@/components/dashboard/payment-required-state";
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner";
import { UnprovisionedAccountState } from "@/components/dashboard/unprovisioned-account-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import prisma from "@/lib/prisma";
import { getSelectedOrgId, getTenantContext, TenantResolutionError, type TenantContext } from "@/server/tenant";

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
  const { userId } = await auth.protect();

  const hasMembership = await prisma.membership.findFirst({
    where: {
      user: { clerkUserId: userId },
      clinic: { deletedAt: null },
    },
    select: { id: true },
  });

  if (!hasMembership) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-muted/30">
          <DashboardHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
            <UnprovisionedAccountState />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  let tenant: TenantContext | null = null;
  let tenantResolutionFailed = false;

  try {
    tenant = await getTenantContext();
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      tenantResolutionFailed = true;
    } else {
      throw error;
    }
  }

  if (tenantResolutionFailed || !tenant) {
    const selectedOrgId = await getSelectedOrgId();

    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-muted/30">
          <DashboardHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
            <EmptyBarbershopState selectedOrgId={selectedOrgId} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const { clinic } = tenant;

  if (!clinic.hasPaidOnce) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-muted/30">
          <DashboardHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
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
        <div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          <SubscriptionBanner status={clinic.subscriptionStatus} />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
