import { ArrowLeftIcon, CalendarDaysIcon, CreditCardIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminAuditLog, Clinic, Membership, PaymentHistory, User } from "@/generated/prisma/client";
import {
  adminActionLabel,
  clinicRoleLabels,
  paymentStatusLabel,
  subscriptionPlanLabel,
  subscriptionStatusLabel,
} from "@/lib/display-labels";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import {
  activateClinicAsPlatformAdmin,
  deleteClinicAsPlatformAdmin,
  removeMembershipAsPlatformAdmin,
  restoreClinicAsPlatformAdmin,
  suspendClinicAsPlatformAdmin,
  updateClinicAsPlatformAdmin,
  updateMembershipRoleAsPlatformAdmin,
} from "@/server/actions/platform-admin";
import { StoreStatusBadge } from "@/app/admin/store-status-badge";

const roleLabels = clinicRoleLabels;

type StoreHeaderClinic = Pick<Clinic, "name" | "slug" | "createdAt" | "deletedAt" | "operationalStatus">;
type StoreDataClinic = Pick<Clinic, "id" | "name" | "slug" | "timeZone" | "maxAppointmentsPerDay">;
type StoreSubscriptionClinic = Pick<
  Clinic,
  "subscriptionStatus" | "subscriptionPlan" | "subscriptionExpiresAt" | "hasPaidOnce"
>;
type StoreLifecycleClinic = Pick<Clinic, "id" | "deletedAt" | "operationalStatus" | "suspensionReason">;
type StoreMembership = Membership & { user: User };

export interface StoreCounts {
  customers: number;
  appointments: number;
  services: number;
  professionals: number;
}

export function StoreHeader({ clinic }: { clinic: StoreHeaderClinic }) {
  const isPubliclyAvailable = !clinic.deletedAt && clinic.operationalStatus === "ACTIVE";

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/lojas" />}>
        <ArrowLeftIcon /> Voltar para negócios
      </Button>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{clinic.name}</h1>
            <StoreStatusBadge clinic={clinic} />
          </div>
          <p className="text-sm text-muted-foreground">
            /{clinic.slug} · criada em {formatDateTime(clinic.createdAt, "America/Sao_Paulo")}
          </p>
        </div>
        {isPubliclyAvailable ? (
          <Button variant="outline" nativeButton={false} render={<Link href={`/${clinic.slug}`} target="_blank" />}>
            Abrir página pública
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function buildStoreMetrics(counts: StoreCounts) {
  return [
    { label: "Clientes", value: counts.customers, icon: UsersIcon },
    { label: "Agendamentos", value: counts.appointments, icon: CalendarDaysIcon },
    { label: "Serviços", value: counts.services, icon: CreditCardIcon },
    { label: "Profissionais", value: counts.professionals, icon: UsersIcon },
  ];
}

export function StoreMetricsGrid({ counts }: { counts: StoreCounts }) {
  const metrics = buildStoreMetrics(counts);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon className="size-5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StoreDataCard({ clinic }: { clinic: StoreDataClinic }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do negócio</CardTitle>
        <CardDescription>
          Alterações de nome, endereço público e limites ficam registradas na auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StoreDataForm clinic={clinic} />
      </CardContent>
    </Card>
  );
}

function StoreDataForm({ clinic }: { clinic: StoreDataClinic }) {
  return (
    <form action={updateClinicAsPlatformAdmin} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="clinicId" value={clinic.id} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={clinic.name} required minLength={2} maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Endereço público</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={clinic.slug}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          maxLength={120}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timeZone">Fuso horário</Label>
        <Input id="timeZone" name="timeZone" defaultValue={clinic.timeZone} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxAppointmentsPerDay">Limite diário</Label>
        <Input
          id="maxAppointmentsPerDay"
          name="maxAppointmentsPerDay"
          type="number"
          min={1}
          max={1000}
          defaultValue={clinic.maxAppointmentsPerDay ?? ""}
          placeholder="Sem limite"
        />
      </div>
      <div className="sm:col-span-2">
        <AdminSubmitButton>Salvar alterações</AdminSubmitButton>
      </div>
    </form>
  );
}

export function StoreSubscriptionCard({ clinic }: { clinic: StoreSubscriptionClinic }) {
  const expiresAt = clinic.subscriptionExpiresAt
    ? formatDateTime(clinic.subscriptionExpiresAt, "America/Sao_Paulo")
    : "-";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinatura</CardTitle>
        <CardDescription>Dados recebidos do provedor de pagamentos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <Badge variant="outline">{subscriptionStatusLabel(clinic.subscriptionStatus)}</Badge>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Plano</span>
          <span>{subscriptionPlanLabel(clinic.subscriptionPlan)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Expira em</span>
          <span>{expiresAt}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Já pagou</span>
          <span>{clinic.hasPaidOnce ? "Sim" : "Não"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LifecycleForm({
  clinicId,
  action,
  label,
  variant = "default",
  help,
  confirm,
}: {
  clinicId: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
  help: string;
  confirm?: { title: string; description: string };
}) {
  return (
    <form action={action} className="space-y-3 rounded-xl border border-border/80 bg-background/50 p-4">
      <input type="hidden" name="clinicId" value={clinicId} />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`reason-${label}`}>Motivo obrigatório</Label>
        <Input
          id={`reason-${label}`}
          name="reason"
          minLength={5}
          maxLength={500}
          required
          placeholder="Registre a justificativa"
        />
      </div>
      <AdminSubmitButton variant={variant} confirm={confirm}>
        {label}
      </AdminSubmitButton>
    </form>
  );
}

function OperationalStateForm({ clinic }: { clinic: StoreLifecycleClinic }) {
  if (clinic.deletedAt) {
    return (
      <LifecycleForm
        clinicId={clinic.id}
        action={restoreClinicAsPlatformAdmin}
        label="Restaurar negócio"
        help="Restaura e reativa imediatamente o negócio."
      />
    );
  }

  if (clinic.operationalStatus === "SUSPENDED") {
    return (
      <LifecycleForm
        clinicId={clinic.id}
        action={activateClinicAsPlatformAdmin}
        label="Reativar negócio"
        help="Libera novamente o painel e os agendamentos."
      />
    );
  }

  return (
    <LifecycleForm
      clinicId={clinic.id}
      action={suspendClinicAsPlatformAdmin}
      label="Suspender negócio"
      variant="secondary"
      help="Bloqueia temporariamente a operação, preservando os dados."
      confirm={{
        title: "Suspender este negócio?",
        description:
          "O painel e o agendamento público ficam bloqueados até a reativação. Os dados são preservados.",
      }}
    />
  );
}

function DeleteStoreForm({ clinicId }: { clinicId: string }) {
  return (
    <LifecycleForm
      clinicId={clinicId}
      action={deleteClinicAsPlatformAdmin}
      label="Excluir negócio"
      variant="destructive"
      help="Executa uma exclusão lógica que poderá ser revertida."
      confirm={{
        title: "Excluir este negócio?",
        description:
          "O negócio sai do ar e deixa de aparecer para a equipe. A exclusão é lógica e pode ser revertida depois.",
      }}
    />
  );
}

export function StoreLifecycleCard({ clinic }: { clinic: StoreLifecycleClinic }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Controle operacional</CardTitle>
        <CardDescription>
          Suspender bloqueia o painel e o agendamento público. Excluir é sempre reversível e não apaga os dados.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <OperationalStateForm clinic={clinic} />
        {!clinic.deletedAt ? <DeleteStoreForm clinicId={clinic.id} /> : null}
        {clinic.suspensionReason ? (
          <p className="text-sm text-muted-foreground lg:col-span-2">Último motivo: {clinic.suspensionReason}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChangeMemberRoleForm({ clinicId, membership }: { clinicId: string; membership: StoreMembership }) {
  return (
    <form action={updateMembershipRoleAsPlatformAdmin} className="space-y-2">
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="membershipId" value={membership.id} />
      <Label htmlFor={`role-${membership.id}`}>Alterar papel</Label>
      <Select name="role" defaultValue={membership.role} items={roleLabels}>
        <SelectTrigger id={`role-${membership.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Administrador</SelectItem>
          <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
          <SelectItem value="PROVIDER">Profissional</SelectItem>
        </SelectContent>
      </Select>
      <Label htmlFor={`role-reason-${membership.id}`} className="sr-only">
        Motivo da alteração
      </Label>
      <Input
        id={`role-reason-${membership.id}`}
        name="reason"
        required
        minLength={5}
        maxLength={500}
        placeholder="Motivo da alteração"
      />
      <AdminSubmitButton variant="outline">Atualizar papel</AdminSubmitButton>
    </form>
  );
}

function RemoveMemberForm({ clinicId, membership }: { clinicId: string; membership: StoreMembership }) {
  return (
    <form action={removeMembershipAsPlatformAdmin} className="space-y-2">
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="membershipId" value={membership.id} />
      <Label htmlFor={`remove-${membership.id}`}>Remover acesso</Label>
      <Input
        id={`remove-${membership.id}`}
        name="reason"
        required
        minLength={5}
        maxLength={500}
        placeholder="Motivo da remoção"
      />
      <AdminSubmitButton
        variant="destructive"
        confirm={{
          title: `Remover ${membership.user.name}?`,
          description:
            "A pessoa perde o acesso a este negócio imediatamente. A conta dela e os acessos a outros negócios não são afetados.",
        }}
      >
        Remover membro
      </AdminSubmitButton>
    </form>
  );
}

function MemberRow({ clinicId, membership }: { clinicId: string; membership: StoreMembership }) {
  return (
    <div className="grid gap-4 rounded-xl border border-border/80 bg-background/50 p-4 lg:grid-cols-[1fr_2fr]">
      <div>
        <p className="font-medium">{membership.user.name}</p>
        <p className="text-sm text-muted-foreground">{membership.user.email ?? "Sem e-mail"}</p>
        <Badge className="mt-2" variant="outline">
          {roleLabels[membership.role]}
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChangeMemberRoleForm clinicId={clinicId} membership={membership} />
        <RemoveMemberForm clinicId={clinicId} membership={membership} />
      </div>
    </div>
  );
}

export function StoreMembersCard({ clinicId, memberships }: { clinicId: string; memberships: StoreMembership[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Membros e permissões</CardTitle>
        <CardDescription>
          As permissões são mantidas pela Cotani. O último administrador nunca pode ser removido ou rebaixado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {memberships.map((membership) => (
          <MemberRow key={membership.id} clinicId={clinicId} membership={membership} />
        ))}
        {!memberships.length ? (
          <p className="text-sm text-muted-foreground">Este negócio não possui membros sincronizados.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaymentRow({ payment }: { payment: PaymentHistory }) {
  return (
    <TableRow>
      <TableCell className="pl-6">{formatDateTime(payment.createdAt, "America/Sao_Paulo")}</TableCell>
      <TableCell>{paymentStatusLabel(payment.status)}</TableCell>
      <TableCell>{subscriptionPlanLabel(payment.plan)}</TableCell>
      <TableCell className="pr-6 text-right">{formatCurrency(Number(payment.amount))}</TableCell>
    </TableRow>
  );
}

export function RecentPaymentsCard({ payments }: { payments: PaymentHistory[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Pagamentos recentes</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="pl-6">Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="pr-6 text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
            {!payments.length ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhum pagamento registrado.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AuditEventItem({ event }: { event: AdminAuditLog }) {
  return (
    <div className="border-b pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">{adminActionLabel(event.action)}</Badge>
        <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt, "America/Sao_Paulo")}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{event.reason ?? "Sem justificativa adicional"}</p>
    </div>
  );
}

export function RecentAuditCard({ events }: { events: AdminAuditLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria recente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => (
          <AuditEventItem key={event.id} event={event} />
        ))}
        {!events.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma ação administrativa registrada.</p>
        ) : null}
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/auditoria" />}>
          Ver auditoria completa
        </Button>
      </CardContent>
    </Card>
  );
}
