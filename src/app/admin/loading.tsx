import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function AdminLoading() {
  return <PageSkeleton label="Carregando administração" stats={3} body="list" />;
}
