import { useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createAppointmentFromForm } from "@/server/actions/appointments";
import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { fetchJson } from "@/lib/fetch-json";
import { refreshQueries } from "@/lib/refresh-queries";
import type { ActionResult, ProfessionalListItem } from "@/types";

const initialState: ActionResult = { status: "success", message: "" };

function announceResult(state: ActionResult, queryClient: QueryClient, onSuccess?: () => void) {
  if (!state.message) {
    return;
  }

  if (state.status === "error") {
    toast.error(state.message);
    return;
  }

  void refreshQueries(queryClient, ["appointments"], "O atendimento foi salvo, mas a lista não pôde ser atualizada.");
  toast.success(state.message);
  onSuccess?.();
}

function useClinicProfessionals() {
  const clinicId = useActiveClinicId();

  return useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => fetchJson<ProfessionalListItem[]>("/api/professionals"),
  });
}

export function useAppointmentForm(onSuccess?: () => void) {
  const [state, formAction, isPending] = useActionState(createAppointmentFromForm, initialState);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const queryClient = useQueryClient();
  const { data: professionals, isFetching: isProfessionalsFetching } = useClinicProfessionals();

  useEffect(() => {
    announceResult(state, queryClient, onSuccess);
  }, [state, queryClient, onSuccess]);

  const availableProfessionals = professionals?.filter(
    (professional) => professional.isActive && professional.serviceIds.includes(serviceId),
  );

  function handleServiceChange(value: unknown) {
    setServiceId(String(value));
    setProfessionalId("");
  }

  function handleProfessionalChange(value: unknown) {
    setProfessionalId(String(value));
  }

  return {
    state,
    formAction,
    isPending,
    serviceId,
    professionalId,
    availableProfessionals,
    isProfessionalsFetching,
    handleServiceChange,
    handleProfessionalChange,
  };
}
