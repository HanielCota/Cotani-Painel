const subscriptionStatusLabels: Record<string, string> = {
  TRIALING: "Período grátis",
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelada",
};

const subscriptionPlanLabels: Record<string, string> = {
  ESSENTIAL: "Essencial",
  PROFESSIONAL: "Profissional",
  ENTERPRISE: "Empresa",
};

const billingCycleLabels: Record<string, string> = {
  MONTHLY: "Mensal",
  ANNUAL: "Anual",
};

const paymentStatusLabels: Record<string, string> = {
  paid: "Pago",
  approved: "Aprovado",
  pending: "Pendente",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  rejected: "Recusado",
  failed: "Falhou",
  authorized: "Autorizado",
  in_process: "Em processamento",
  in_mediation: "Em análise",
  charged_back: "Contestado",
};

const adminActionLabels: Record<string, string> = {
  CLINIC_UPDATED: "Loja atualizada",
  CLINIC_SUSPENDED: "Loja suspensa",
  CLINIC_ACTIVATED: "Loja reativada",
  CLINIC_SOFT_DELETED: "Loja excluída",
  CLINIC_RESTORED: "Loja restaurada",
  MEMBERSHIP_ROLE_UPDATED: "Papel do membro alterado",
  MEMBERSHIP_REMOVED: "Membro removido",
};

const adminTargetLabels: Record<string, string> = {
  Clinic: "Loja",
  Membership: "Vínculo de membro",
};

export const clinicRoleLabels = {
  ADMIN: "Administrador",
  RECEPTIONIST: "Recepcionista",
  PROVIDER: "Profissional",
} as const;

const appointmentStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

const appointmentStatusBadgeVariants = {
  PENDING: "secondary",
  CONFIRMED: "success",
  COMPLETED: "default",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
} as const;

export function appointmentStatusLabel(status: string): string {
  return appointmentStatusLabels[status] ?? "Status não reconhecido";
}

export function appointmentStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "success" {
  return appointmentStatusBadgeVariants[status as keyof typeof appointmentStatusBadgeVariants] ?? "secondary";
}

export function clinicRoleLabel(role: string): string {
  return clinicRoleLabels[role as keyof typeof clinicRoleLabels] ?? "Perfil não reconhecido";
}

export function subscriptionStatusLabel(status: string): string {
  return subscriptionStatusLabels[status] ?? "Status não reconhecido";
}

export function subscriptionPlanLabel(plan: string | null | undefined): string {
  return plan ? subscriptionPlanLabels[plan] ?? "Plano não reconhecido" : "Sem plano";
}

export function billingCycleLabel(cycle: string | null | undefined): string {
  return cycle ? billingCycleLabels[cycle] ?? "Ciclo não reconhecido" : "Sem ciclo";
}

export function paymentStatusLabel(status: string): string {
  return paymentStatusLabels[status.toLowerCase()] ?? "Status não reconhecido";
}

export function adminActionLabel(action: string): string {
  return adminActionLabels[action] ?? "Ação administrativa";
}

export function adminTargetLabel(target: string): string {
  return adminTargetLabels[target] ?? "Registro";
}
