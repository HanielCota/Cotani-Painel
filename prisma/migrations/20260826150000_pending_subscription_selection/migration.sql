-- Mantém a escolha do checkout separada do plano com benefícios ativos.
ALTER TABLE "Clinic"
  ADD COLUMN "pendingSubscriptionPlan" "SubscriptionPlan",
  ADD COLUMN "pendingSubscriptionCycle" "BillingCycle";
