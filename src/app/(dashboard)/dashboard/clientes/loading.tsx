import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function CustomersLoading() {
  return <PageSkeleton label="Carregando clientes" body="list" />;
}
