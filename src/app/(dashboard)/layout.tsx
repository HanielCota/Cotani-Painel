import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { PaymentRequiredState } from "@/components/dashboard/payment-required-state";
import { ClinicSuspendedState } from "@/components/dashboard/clinic-suspended-state";
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner";
import { UnprovisionedAccountState } from "@/components/dashboard/unprovisioned-account-state";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import prisma from "@/lib/prisma";
import { getSelectedOrgId, getTenantContext, TenantResolutionError, type TenantContext } from "@/server/tenant";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface DashboardShellProps {
  children: React.ReactNode;
  insetClassName?: string;
}

export const metadata: Metadata = {
  title: {
    default: "Painel",
    template: "%s | Cotani",
  },
};

function DashboardShell({ children, insetClassName = "bg-background" }: DashboardShellProps) {
  return (
    <SidebarProvider className="min-h-svh">
      <AppSidebar />
      <SidebarInset className={insetClassName}>
        <div className="px-4 pt-4 md:hidden">
          <SidebarTrigger className="size-9 border border-border/60 bg-card shadow-sm" />
        </div>
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:px-10 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

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
      <DashboardShell>
        <UnprovisionedAccountState />
      </DashboardShell>
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
      <DashboardShell>
        <EmptyBarbershopState selectedOrgId={selectedOrgId} />
      </DashboardShell>
    );
  }

  const { clinic } = tenant;

  if (clinic.operationalStatus === "SUSPENDED" || clinic.deletedAt) {
    return (
      <DashboardShell>
        <ClinicSuspendedState reason={clinic.suspensionReason} />
      </DashboardShell>
    );
  }

  if (!clinic.hasPaidOnce) {
    return (
      <DashboardShell>
        <PaymentRequiredState barbershopName={clinic.name} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <SubscriptionBanner status={clinic.subscriptionStatus} />
      {children}
    </DashboardShell>
  );
}
