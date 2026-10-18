import { CheckIcon, MinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUBSCRIPTION_PLANS, type PlanEntitlements } from "@/config/subscription-plans";
import type { SubscriptionPlan } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface ComparisonRow {
  label: string;
  value: (entitlements: PlanEntitlements) => boolean | string;
}

/**
 * Linhas derivadas das permissões de cada plano (a mesma fonte que libera ou
 * bloqueia os recursos no painel), para a tabela nunca prometer o que o plano
 * não entrega.
 */
const ROWS: readonly ComparisonRow[] = [
  { label: "Profissionais", value: (plan) => (plan.maxProfessionals === null ? "Ilimitados" : plan.maxProfessionals === 1 ? "1" : `Até ${plan.maxProfessionals}`) },
  { label: "Agendamentos", value: () => "Ilimitados" },
  { label: "Agendamento on-line pelo link", value: () => true },
  { label: "WhatsApp manual e lembretes por e-mail", value: (plan) => plan.whatsapp && plan.email },
  { label: "Financeiro", value: (plan) => plan.finance },
  { label: "Relatórios mensais", value: (plan) => plan.monthlyReports },
  { label: "Relatórios avançados e exportação", value: (plan) => plan.advancedReports },
  { label: "Múltiplas unidades", value: (plan) => plan.multipleLocations },
  { label: "Suporte prioritário", value: (plan) => plan.prioritySupport },
];

const PLAN_ORDER: readonly SubscriptionPlan[] = ["ESSENTIAL", "PROFESSIONAL", "ENTERPRISE"];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="font-medium">{value}</span>;
  return value
    ? <CheckIcon aria-label="Incluído" className="mx-auto size-4 text-primary" />
    : <MinusIcon aria-label="Não incluído" className="mx-auto size-4 text-muted-foreground/60" />;
}

/** Comparação lado a lado dos planos, com a coluna do plano atual destacada. */
export function PlanComparisonTable({ currentPlan }: { currentPlan: SubscriptionPlan | null }) {
  const plans = PLAN_ORDER.map((id) => SUBSCRIPTION_PLANS[id]);
  const highlight = (id: SubscriptionPlan) => id === currentPlan && "bg-primary/5";

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table className="min-w-[36rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%]"><span className="sr-only">Recurso</span></TableHead>
            {plans.map((plan) => (
              <TableHead key={plan.id} className={cn("h-auto py-3 text-center align-top", highlight(plan.id))}>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatCurrency(plan.monthlyPrice)}/mês</span>
                  {plan.id === currentPlan ? <Badge variant="secondary">Seu plano</Badge> : null}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.label} className="hover:bg-transparent">
              <TableCell className="text-muted-foreground">{row.label}</TableCell>
              {plans.map((plan) => (
                <TableCell key={plan.id} className={cn("text-center", highlight(plan.id))}>
                  <Cell value={row.value(plan.entitlements)} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
