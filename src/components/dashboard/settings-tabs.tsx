"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UsersIcon } from "lucide-react";

import { BusinessHoursSettings } from "@/components/dashboard/business-hours-settings";
import { ClinicSettings } from "@/components/dashboard/clinic-settings";
import { ProfessionalsSettings } from "@/components/dashboard/professionals-settings";
import { ServicesSettings } from "@/components/dashboard/services-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BusinessHourItem } from "@/types";

interface SettingsTabsProps {
  defaultTab: string;
  maxAppointmentsPerDay: number | null;
  initialBusinessHours: BusinessHourItem[];
}

const validTabs = ["services", "professionals", "business-hours"];

export function SettingsTabs({ defaultTab, maxAppointmentsPerDay, initialBusinessHours }: SettingsTabsProps) {
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
    </Tabs>
  );
}
