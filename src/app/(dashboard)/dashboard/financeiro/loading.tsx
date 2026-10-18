import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function FinanceLoading() {
  return <PageSkeleton label="Carregando financeiro" stats={4} />;
}
