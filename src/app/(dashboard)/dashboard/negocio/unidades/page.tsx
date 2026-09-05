import { Building2Icon } from "lucide-react";
import type { Metadata } from "next";

import { getPlanEntitlements } from "@/config/subscription-plans";
import { LocationsSettings } from "@/components/dashboard/locations-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Unidades" };

export default withTenant(async ({ clinic, membership }) => {
  const billingOwnerId = clinic.billingOwnerId ?? clinic.id;
  const locations = await prisma.membership.findMany({
    where: { userId: membership.userId, clinic: { OR: [{ id: billingOwnerId }, { billingOwnerId }] } },
    include: { clinic: true },
    orderBy: { clinic: { name: "asc" } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Unidades" description="Gerencie os estabelecimentos vinculados à assinatura." />
      <Card className="max-w-5xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2Icon />Unidades do negócio</CardTitle>
          <CardDescription>Cada unidade mantém sua própria agenda, equipe e serviços.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationsSettings
            enabled={getPlanEntitlements(clinic.subscriptionPlan).multipleLocations}
            locations={locations.map(({ clinic: location }) => ({ id: location.id, name: location.name, active: location.operationalStatus === "ACTIVE" && !location.deletedAt, primary: location.id === billingOwnerId }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN"]);
