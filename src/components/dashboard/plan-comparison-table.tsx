import { CheckIcon, MinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUBSCRIPTION_PLANS, type PlanEntitlements, type ProductPlan } from "@/config/subscription-plans";
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

function Cell({ value, align = "center" }: { value: boolean | string; align?: "center" | "end" }) {
  const position = align === "center" ? "mx-auto" : "ml-auto";
  if (typeof value === "string") return <span className="font-medium">{value}</span>;
  return value
    ? <CheckIcon aria-label="Incluído" className={cn(position, "size-4 text-primary")} />
    : <MinusIcon aria-label="Não incluído" className={cn(position, "size-4 text-muted-foreground/60")} />;
}

/** Plano sem contratação pelo painel (Empresa) não mostra preço de tabela. */
function priceLabel(plan: ProductPlan) {
  if (!plan.selfServiceCheckout) return "Fale com a equipe";
  return `${formatCurrency(plan.monthlyPrice)}/mês`;
}

function PlanSummary({ plan, isCurrent }: { plan: ProductPlan; isCurrent: boolean }) {
  return (
    <>
      <span className="text-sm font-semibold text-foreground">{plan.name}</span>
      <span className="text-xs font-normal text-muted-foreground tabular-nums">{priceLabel(plan)}</span>
      {isCurrent ? <Badge variant="secondary">Seu plano</Badge> : null}
    </>
  );
}

/** Celular: um cartão por plano, empilhados, sem rolagem lateral. */
function PlanCards({ plans, currentPlan }: { plans: ProductPlan[]; currentPlan: SubscriptionPlan | null }) {
  return (
    <ul aria-label="Planos" className="flex flex-col gap-3 sm:hidden">
      {plans.map((plan) => (
        <li key={plan.id} className={cn("rounded-xl border p-4", plan.id === currentPlan && "border-primary/40 bg-primary/5")}>
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <PlanSummary plan={plan} isCurrent={plan.id === currentPlan} />
          </div>
          <dl className="flex flex-col divide-y text-sm">
            {ROWS.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right"><Cell value={row.value(plan.entitlements)} align="end" /></dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** A partir de sm: comparação lado a lado, com a coluna do plano atual destacada. */
function PlanTable({ plans, currentPlan }: { plans: ProductPlan[]; currentPlan: SubscriptionPlan | null }) {
  const highlight = (id: SubscriptionPlan) => id === currentPlan && "bg-primary/5";

  return (
    <div className="hidden overflow-x-auto rounded-xl border sm:block">
      <Table className="min-w-[36rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%]"><span className="sr-only">Recurso</span></TableHead>
            {plans.map((plan) => (
              <TableHead key={plan.id} className={cn("h-auto py-3 text-center align-top", highlight(plan.id))}>
                <div className="flex flex-col items-center gap-1">
                  <PlanSummary plan={plan} isCurrent={plan.id === currentPlan} />
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

/** Comparação dos planos: cartões empilhados no celular, tabela a partir de sm. */
export function PlanComparisonTable({ currentPlan }: { currentPlan: SubscriptionPlan | null }) {
  const plans = PLAN_ORDER.map((id) => SUBSCRIPTION_PLANS[id]);

  return (
    <>
      <PlanCards plans={plans} currentPlan={currentPlan} />
      <PlanTable plans={plans} currentPlan={currentPlan} />
    </>
  );
}
