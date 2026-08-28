"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building2Icon, UsersIcon } from "lucide-react";

import { BusinessHoursSettings } from "@/components/dashboard/business-hours-settings";
import { ClinicSettings } from "@/components/dashboard/clinic-settings";
import { ProfessionalsSettings } from "@/components/dashboard/professionals-settings";
import { ServicesSettings } from "@/components/dashboard/services-settings";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { LocationsSettings } from "@/components/dashboard/locations-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BusinessHourItem } from "@/types";

interface SettingsTabsProps {
  defaultTab: string;
  maxAppointmentsPerDay: number | null;
  initialBusinessHours: BusinessHourItem[];
  members?: { id: string; name: string; email: string | null; role: "ADMIN" | "RECEPTIONIST" | "PROVIDER"; isCurrent: boolean; professionalId: string | null }[];
  invitations?: { id: string; email: string; role: "ADMIN" | "RECEPTIONIST" | "PROVIDER"; expiresAt: string; professionalId: string | null }[];
  professionals?: { id: string; name: string; available: boolean }[];
  locations?: { id: string; name: string; active: boolean }[];
  multipleLocationsEnabled?: boolean;
}

const validTabs = ["services", "professionals", "business-hours", "team", "locations"];

export function SettingsTabs({ defaultTab, maxAppointmentsPerDay, initialBusinessHours, members = [], invitations = [], professionals = [], locations = [], multipleLocationsEnabled = false }: SettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab = validTabs.includes(tabFromUrl ?? "")
    ? tabFromUrl!
    : validTabs.includes(defaultTab)
      ? defaultTab
      : "services";

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/dashboard/configuracoes?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange}>
      <div className="overflow-x-auto pb-1 -mb-1">
        <TabsList className="w-full min-w-fit sm:w-fit">
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="professionals" className="flex items-center gap-1.5">
            <UsersIcon className="size-3.5" />
            Profissionais
          </TabsTrigger>
          <TabsTrigger value="business-hours">Expediente</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-1.5"><Building2Icon className="size-3.5" />Unidades</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="services" className="pt-4">
        <ServicesSettings />
      </TabsContent>
      <TabsContent value="professionals" className="pt-4">
        <ProfessionalsSettings />
      </TabsContent>
      <TabsContent value="business-hours" className="pt-4">
        <div className="flex flex-col gap-6">
          <ClinicSettings maxAppointmentsPerDay={maxAppointmentsPerDay} />
          <BusinessHoursSettings
            key={initialBusinessHours.map((hour) => `${hour.dayOfWeek}-${hour.isOpen}-${hour.openTime}-${hour.closeTime}-${hour.breakStart}-${hour.breakEnd}`).join("|")}
            businessHours={initialBusinessHours}
          />
        </div>
      </TabsContent>
      <TabsContent value="team" className="pt-4"><TeamSettings members={members} invitations={invitations} professionals={professionals} /></TabsContent>
      <TabsContent value="locations" className="pt-4"><LocationsSettings enabled={multipleLocationsEnabled} locations={locations} /></TabsContent>
    </Tabs>
  );
}
