import { Building2Icon, CalendarClockIcon, ScissorsIcon, StoreIcon, UserCogIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NavCard } from "@/components/ui/nav-card";
import { withTenant } from "@/server/with-tenant";
import { BusinessProfileForm } from "@/components/dashboard/business-profile-form";

export const metadata: Metadata = { title: "Perfil do negócio" };

const sections = [
  { title: "Serviços", description: "Preços, duração e disponibilidade.", href: "/dashboard/negocio/servicos", icon: ScissorsIcon },
  { title: "Profissionais", description: "Quem realiza os atendimentos.", href: "/dashboard/negocio/profissionais", icon: UserRoundIcon },
  { title: "Horários", description: "Expediente, intervalos e limite diário.", href: "/dashboard/negocio/horarios", icon: CalendarClockIcon },
  { title: "Equipe e acessos", description: "Convites e permissões do painel.", href: "/dashboard/negocio/equipe", icon: UserCogIcon },
  { title: "Unidades", description: "Unidades vinculadas à assinatura.", href: "/dashboard/negocio/unidades", icon: Building2Icon },
] as const;

export default withTenant(async ({ clinic }) => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Perfil do negócio" description={`Identificação e endereço público de ${clinic.name}.`} />

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><StoreIcon className="text-primary" />Informações principais</CardTitle>
        <CardDescription>Identificação usada no painel e no agendamento on-line.</CardDescription>
      </CardHeader>
      <CardContent><BusinessProfileForm clinic={clinic} /></CardContent>
    </Card>

    <section className="space-y-3" aria-labelledby="business-settings">
      <SectionHeader id="business-settings" title="Outras configurações" description="Cadastros e regras usados na agenda e no agendamento on-line." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => <NavCard key={section.href} {...section} />)}
      </div>
    </section>
  </div>
), ["ADMIN"]);
