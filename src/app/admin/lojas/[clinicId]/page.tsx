import { notFound } from "next/navigation";

import { AdminFlash } from "@/components/admin/admin-flash";
import prisma from "@/lib/prisma";

import {
  RecentAuditCard,
  RecentPaymentsCard,
  StoreDataCard,
  StoreHeader,
  StoreLifecycleCard,
  StoreMembersCard,
  StoreMetricsGrid,
  StoreSubscriptionCard,
} from "./store-detail-sections";

async function loadStoreDetail(clinicId: string) {
  return prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      memberships: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], include: { user: true } },
      paymentHistory: { orderBy: { createdAt: "desc" }, take: 10 },
      adminAuditLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { customers: true, appointments: true, services: true, professionals: true } },
    },
  });
}

export default async function StoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string }>;
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const [{ clinicId }, flash] = await Promise.all([params, searchParams]);
  const clinic = await loadStoreDetail(clinicId);
  if (!clinic) notFound();

  return (
    <>
      <StoreHeader clinic={clinic} />

      <AdminFlash status={flash.status} message={flash.message} />

      <StoreMetricsGrid counts={clinic._count} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <StoreDataCard clinic={clinic} />

        <StoreSubscriptionCard clinic={clinic} />
      </div>

      <StoreLifecycleCard clinic={clinic} />

      <StoreMembersCard clinicId={clinic.id} memberships={clinic.memberships} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentPaymentsCard payments={clinic.paymentHistory} />

        <RecentAuditCard events={clinic.adminAuditLogs} />
      </div>
    </>
  );
}
