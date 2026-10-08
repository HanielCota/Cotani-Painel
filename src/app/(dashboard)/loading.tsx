import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DashboardLoading() {
  return <PageSkeleton label="Carregando painel" stats={4} />;
}
