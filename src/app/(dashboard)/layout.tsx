import type { Metadata } from "next";
import type { ClinicRole, SubscriptionPlan } from "@/generated/prisma/enums";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ActiveClinicProvider } from "@/components/dashboard/active-clinic-context";
import { EmptyClinicState } from "@/components/dashboard/empty-clinic-state";
import { PaymentRequiredState } from "@/components/dashboard/payment-required-state";
import { ClinicSuspendedState } from "@/components/dashboard/clinic-suspended-state";
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ensureCurrentAppUser } from "@/server/auth";
import { getAvailableClinics, getSelectedClinicId, getTenantContext, TenantResolutionError, type TenantContext } from "@/server/tenant";
import { isSubscriptionActive } from "@/server/subscription";
import { getSubscriptionPlanOptions } from "@/server/services/subscription-plan-options";
import { requiresMfaVerification } from "@/server/auth";
import { redirect } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface DashboardShellProps {
  children: React.ReactNode;
  insetClassName?: string;
  subscriptionPlan?: SubscriptionPlan | null;
  user: { name: string; email: string | null };
  clinics: { id: string; name: string }[];
  activeClinicId?: string | null;
  role?: ClinicRole;
}

export const metadata: Metadata = {
  title: {
    default: "Painel",
    template: "%s | Cotani",
  },
};

function DashboardShell({ children, insetClassName = "bg-background", subscriptionPlan, user, clinics, activeClinicId, role }: DashboardShellProps) {
  return (
    <ActiveClinicProvider clinicId={activeClinicId}>
    <SidebarProvider className="min-h-svh">
      <AppSidebar subscriptionPlan={subscriptionPlan} role={role} user={user} clinics={clinics} activeClinicId={activeClinicId} />
      <SidebarInset id="main-content" tabIndex={-1} className={insetClassName}>
        <div className="px-4 pt-4 md:hidden">
          <SidebarTrigger className="size-9 border border-border/60 bg-card shadow-sm" />
        </div>
        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-5 p-4 pb-10 sm:gap-6 sm:p-6 sm:pb-12 lg:px-8 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ActiveClinicProvider>
  );
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  if (await requiresMfaVerification()) redirect("/mfa?redirect=/dashboard");
  const [{ appUser }, memberships, selectedClinicId] = await Promise.all([
    ensureCurrentAppUser(),
    getAvailableClinics(),
    getSelectedClinicId(),
  ]);
  const sidebarProps = {
    user: { name: appUser.name, email: appUser.email },
    clinics: memberships.map(({ clinic }) => ({ id: clinic.id, name: clinic.name })),
    activeClinicId: selectedClinicId,
  };

  if (memberships.length === 0) {
    return (
      <DashboardShell {...sidebarProps}>
        <EmptyClinicState />
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
    return (
      <DashboardShell {...sidebarProps}>
        <EmptyClinicState />
      </DashboardShell>
    );
  }

  const { clinic, role } = tenant;

  if (clinic.operationalStatus === "SUSPENDED" || clinic.deletedAt) {
    return (
      <DashboardShell {...sidebarProps}>
        <ClinicSuspendedState reason={clinic.suspensionReason} />
      </DashboardShell>
    );
  }

  if (!clinic.hasPaidOnce && !isSubscriptionActive(clinic)) {
    return (
      <DashboardShell {...sidebarProps} activeClinicId={clinic.id} subscriptionPlan={clinic.subscriptionPlan} role={role}>
        <PaymentRequiredState clinicName={clinic.name} plans={role === "ADMIN" ? getSubscriptionPlanOptions() : undefined} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell {...sidebarProps} activeClinicId={clinic.id} subscriptionPlan={clinic.subscriptionPlan} role={role}>
      <SubscriptionBanner status={clinic.subscriptionStatus} />
      {children}
    </DashboardShell>
  );
}
