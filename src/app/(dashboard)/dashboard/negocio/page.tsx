import { Building2Icon, CalendarDaysIcon, ExternalLinkIcon, SparklesIcon, StoreIcon, Users2Icon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Seu negócio" };

const sections = [
  { title: "Serviços", description: "Organize preços, duração e disponibilidade.", href: "/dashboard/negocio/servicos", icon: SparklesIcon },
  { title: "Profissionais", description: "Cadastre a equipe que realiza os atendimentos.", href: "/dashboard/negocio/profissionais", icon: Users2Icon },
  { title: "Horários", description: "Defina expediente, intervalos e limite diário.", href: "/dashboard/negocio/horarios", icon: CalendarDaysIcon },
  { title: "Equipe", description: "Gerencie acessos e convites para o painel.", href: "/dashboard/negocio/equipe", icon: UsersIcon },
  { title: "Unidades", description: "Visualize e administre unidades vinculadas.", href: "/dashboard/negocio/unidades", icon: Building2Icon },
] as const;

export default withTenant(async ({ clinic }) => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Seu negócio" description={`Cadastros e regras operacionais de ${clinic.name}.`} />

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><StoreIcon />Informações principais</CardTitle>
        <CardDescription>Identificação usada no painel e no agendamento on-line.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs font-medium text-muted-foreground">Nome</p><p className="mt-1 font-medium">{clinic.name}</p></div>
          <div><p className="text-xs font-medium text-muted-foreground">Fuso horário</p><p className="mt-1 font-medium">{clinic.timeZone.replace("_", " ")}</p></div>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href={`/${clinic.slug}`} target="_blank" rel="noreferrer" />}>
          <ExternalLinkIcon />Abrir página pública
        </Button>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map(({ title, description, href, icon: Icon }) => (
        <Card key={href} className="transition-colors hover:border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Icon />{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent><Button nativeButton={false} variant="outline" render={<Link href={href} />}>Gerenciar</Button></CardContent>
        </Card>
      ))}
    </div>
  </div>
), ["ADMIN"]);
