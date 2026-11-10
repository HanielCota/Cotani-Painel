import { useState, useTransition, type FormEvent, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createProfessionalFromForm, updateProfessionalFromForm } from "@/server/actions/professionals";
import { useServices } from "@/hooks/use-services";
import type { ActionResult, ProfessionalListItem } from "@/types";

function toggleId(currentIds: string[], id: string) {
  return currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [...currentIds, id];
}

function buildProfessionalFormData(form: HTMLFormElement, selectedServiceIds: string[]) {
  const formData = new FormData(form);
  // Checkboxes already contribute their values to FormData. Rebuild this
  // field from state so each selected service is submitted exactly once.
  formData.delete("serviceIds");
  new Set(selectedServiceIds).forEach((serviceId) => formData.append("serviceIds", serviceId));
  return formData;
}

function useSaveProfessional(isEditing: boolean) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const action = isEditing ? updateProfessionalFromForm : createProfessionalFromForm;

  function saveProfessional(formData: FormData, onSaved: () => void) {
    startTransition(async () => {
      const nextResult = await action({ status: "success", message: "" }, formData);

      if (nextResult.status === "error") {
        setResult(nextResult);
        toast.error(nextResult.message);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["professionals"] }),
        queryClient.invalidateQueries({ queryKey: ["services"] }),
      ]);
      onSaved();
      toast.success(nextResult.message);
    });
  }

  return { result, setResult, isPending, saveProfessional };
}

export function useProfessionalForm(
  formRef: RefObject<HTMLFormElement | null>,
  professional?: ProfessionalListItem,
) {
  const isEditing = Boolean(professional);
  const [open, setOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(professional?.serviceIds ?? []);
  const { result, setResult, isPending, saveProfessional } = useSaveProfessional(isEditing);
  const { data: services, isPending: isServicesPending } = useServices();

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) => toggleId(current, serviceId));
  }

  function clearForm() {
    formRef.current?.reset();
    setSelectedServiceIds([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    setResult(null);
    if (nextOpen) {
      setSelectedServiceIds(professional?.serviceIds ?? []);
      return;
    }

    clearForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = buildProfessionalFormData(event.currentTarget, selectedServiceIds);

    saveProfessional(formData, () => {
      setOpen(false);
      clearForm();
    });
  }

  return {
    isEditing,
    open,
    selectedServiceIds,
    result,
    isPending,
    services,
    isServicesPending,
    toggleService,
    handleOpenChange,
    handleSubmit,
  };
}
