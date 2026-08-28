import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  status: string;
  plan: string | null;
  billingCycle: string | null;
  paidAt: string | null;
  createdAt: string;
}

export async function getPaymentHistory(clinic: ClinicModel): Promise<PaymentHistoryItem[]> {
  const payments = await prisma.paymentHistory.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    plan: payment.plan,
    billingCycle: payment.billingCycle,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  }));
}
