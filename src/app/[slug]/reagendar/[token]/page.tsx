import { notFound } from "next/navigation";
import { BookingSteps } from "@/components/public/booking-steps";
import { ClinicUnavailable } from "@/components/public/clinic-unavailable";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { isSubscriptionActive } from "@/server/subscription";

interface Props { params: Promise<{ slug: string; token: string }> }
export default async function ReschedulePage({ params }: Props) {
  const { slug, token } = await params;
  const clinic = await prisma.clinic.findFirst({ where: { deletedAt: null, OR: [{ slug }, { slugAliases: { some: { slug } } }] }, include: { billingOwner: true, services: { where: { isActive: true }, orderBy: { name: "asc" } }, professionals: { where: { isActive: true }, include: { services: true }, orderBy: { name: "asc" } } } });
  if (!clinic) notFound();
  if (clinic.operationalStatus !== "ACTIVE" || !isSubscriptionActive(clinic)) return <ClinicUnavailable clinicName={clinic.name} />;
  const appointment = await prisma.appointment.findFirst({ where: { cancellationToken: token, clinicId: clinic.id, status: { in: ["PENDING", "CONFIRMED"] }, startTime: { gt: new Date() } }, select: { serviceId: true, professionalId: true } });
  if (!appointment) notFound();
  return <main id="main-content" className="relative mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12"><header className="text-center"><p className="text-sm font-semibold text-primary">Reagendamento on-line</p><h1 className="text-3xl font-bold">{clinic.name}</h1></header><BookingSteps slug={clinic.slug} clinicName={clinic.name} minDate={formatClinicDateTimeInput(new Date(), clinic.timeZone).slice(0,10)} rescheduleToken={token} initialServiceId={appointment.serviceId} initialProfessionalId={appointment.professionalId ?? ""} services={clinic.services.map((item) => ({ id: item.id, name: item.name, duration: item.duration, price: Number(item.price), imageUrl: item.imageUrl }))} professionals={clinic.professionals.map((item) => ({ id: item.id, name: item.name, imageUrl: item.imageUrl, serviceIds: item.services.map((relation) => relation.serviceId) }))} /></main>;
}
