"use client";

import { CalendarPlusIcon, CheckIcon, ImageIcon, UserIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/formatters";
import type { BookingProfessional, BookingService, BookingStep } from "./booking-types";

export function BookingStepIndicator({ current }: { current: BookingStep }) {
  const steps: { id: BookingStep; label: string }[] = [
    { id: "service-professional", label: "Serviço" },
    { id: "datetime", label: "Data e hora" },
    { id: "customer", label: "Seus dados" },
  ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Progresso do agendamento">
      <ol className="flex w-full min-w-0 items-center gap-2 sm:justify-between">
        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = step.id === current;
          return (
            <li key={step.id} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/20" : isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {isActive && !isCurrent ? <CheckIcon aria-hidden="true" className="size-4" /> : index + 1}
              </div>
              <span className={`truncate px-1 text-center text-xs ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface BookingSelectionStepProps {
  services: BookingService[];
  professionals: BookingProfessional[];
  selectedServiceId: string;
  selectedProfessionalId: string;
  onServiceSelect: (service: BookingService) => void;
  onProfessionalSelect: (professional: BookingProfessional) => void;
}

export function BookingSelectionStep({ services, professionals, selectedServiceId, selectedProfessionalId, onServiceSelect, onProfessionalSelect }: BookingSelectionStepProps) {
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const availableProfessionals = selectedService ? professionals.filter((professional) => professional.serviceIds.includes(selectedService.id)) : [];

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div className="flex items-center gap-2 text-primary"><CalendarPlusIcon className="size-5" /><h2 className="text-lg font-semibold">Escolha o serviço e o profissional</h2></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const selected = selectedServiceId === service.id;
          return (
            <button key={service.id} type="button" aria-pressed={selected} onClick={() => onServiceSelect(service)} className={`flex min-h-[5.5rem] min-w-0 items-center gap-4 overflow-hidden rounded-xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"}`}>
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica pode vir do armazenamento configurado pela loja.
                <img src={service.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-border sm:size-16" />
              ) : <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:size-16"><ImageIcon className="size-6" /></div>}
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden"><span className="truncate font-semibold leading-tight">{service.name}</span><span className="text-sm text-muted-foreground">{service.duration} min</span><span className="text-base font-bold text-primary">{formatCurrency(service.price)}</span></div>
            </button>
          );
        })}
      </div>
      {selectedService ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary"><UserIcon className="size-5" /><h3 className="text-base font-semibold">Profissional para {selectedService.name}</h3></div>
          {availableProfessionals.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background/50 p-6 text-center"><UserIcon className="mx-auto size-8 text-muted-foreground" /><p className="mt-2 text-sm font-medium text-foreground">Nenhum profissional disponível</p><p className="text-sm text-muted-foreground">Não há profissionais vinculados a este serviço no momento.</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {availableProfessionals.map((professional) => {
                const selected = selectedProfessionalId === professional.id;
                return (
                  <button key={professional.id} type="button" aria-pressed={selected} onClick={() => onProfessionalSelect(professional)} className={`flex min-h-[4.5rem] min-w-0 items-center gap-4 overflow-hidden rounded-xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"}`}>
                    <Avatar className="size-12 sm:size-14">{professional.imageUrl ? <AvatarImage src={professional.imageUrl} alt="" /> : null}<AvatarFallback className="bg-primary/10 text-primary"><UserIcon className="size-5 sm:size-6" /></AvatarFallback></Avatar>
                    <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden"><span className="truncate font-semibold leading-tight">{professional.name}</span><span className="text-sm text-muted-foreground">Profissional</span></div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
