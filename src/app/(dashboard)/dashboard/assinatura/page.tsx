import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs } from "@/components/ui/tabs";
import { SubscriptionPlan } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import { getPlanFitIssues } from "@/server/services/billing-access";
import { getPaymentHistory, type PaymentHistoryItem } from "@/server/services/payment-history";
import { getSubscriptionPlanOptions } from "@/server/services/subscription-plan-options";
import { isSubscriptionActive } from "@/server/subscription";
import { withTenant } from "@/server/with-tenant";

import { CurrentPlanTab, PaymentHistoryTab, RenewTab, SubscriptionTabsList } from "./subscription-sections";

export const metadata: Metadata = { title: "Assinatura" };

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60_000;

async function loadPlanFitIssues(clinic: ClinicModel) {
  const billingOwnerId = clinic.billingOwnerId ?? clinic.id;
  const [essentialIssues, professionalIssues] = await Promise.all([
    getPlanFitIssues(billingOwnerId, SubscriptionPlan.ESSENTIAL),
    getPlanFitIssues(billingOwnerId, SubscriptionPlan.PROFESSIONAL),
  ]);

  return { ESSENTIAL: essentialIssues, PROFESSIONAL: professionalIssues };
}

function isRefundEligible(paymentHistory: PaymentHistoryItem[]) {
  const latestApproved = paymentHistory.find((payment) => payment.status === "approved" && payment.paidAt);
  if (!latestApproved?.paidAt) return false;

  return Date.now() - new Date(latestApproved.paidAt).getTime() <= REFUND_WINDOW_MS;
}

export default withTenant(
  async ({ clinic }) => {
    const active = isSubscriptionActive(clinic);
    const plans = getSubscriptionPlanOptions();
    const paymentHistory = await getPaymentHistory(clinic);
    const issuesByPlan = await loadPlanFitIssues(clinic);

    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Assinatura" description={`Gerencie o plano da ${clinic.name}.`} />

        <Tabs defaultValue="current" className="w-full">
          <SubscriptionTabsList />

          <CurrentPlanTab
            clinic={clinic}
            active={active}
            refundEligible={isRefundEligible(paymentHistory)}
            issuesByPlan={issuesByPlan}
          />

          <RenewTab plans={plans} />

          <PaymentHistoryTab paymentHistory={paymentHistory} />
        </Tabs>
      </div>
    );
  },
  ["ADMIN"],
);
