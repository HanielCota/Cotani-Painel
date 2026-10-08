"use client";

import { useState, type ChangeEvent } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserIcon } from "lucide-react";

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { formatBrazilianPhoneInput, isValidBrazilianPhone } from "@/lib/phone";
import type { AvailabilitySlot, BookingProfessional, BookingService } from "./booking-types";

export function getCustomerStorageKey(slug: string): string { return `cotani:customer:${slug}`; }

function readSavedCustomer(slug: string): { name?: string } {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(sessionStorage.getItem(getCustomerStorageKey(slug)) ?? "{}") as { name?: string }; } catch { return {}; }
}

interface BookingCustomerStepProps {
  isPending: boolean;
  slug: string;
  clinicName: string;
  service: BookingService | undefined;
  professional: BookingProfessional | undefined;
  date: string;
  slot: AvailabilitySlot | null;
}

export function BookingCustomerStep({ isPending, slug, clinicName, service, professional, date, slot }: BookingCustomerStepProps) {
  const [customerName, setCustomerName] = useState(() => readSavedCustomer(slug).name ?? "");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const formattedDate = date ? format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : null;
  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => { setPhone(formatBrazilianPhoneInput(event.target.value)); setPhoneError(false); };

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      <div className="flex items-center gap-2 text-primary"><UserIcon className="size-5" /><h2 className="text-lg font-semibold">Seus dados</h2></div>
      <div className="rounded-xl border bg-background/60 p-4 text-sm">
        <h3 className="mb-3 font-semibold">Resumo do agendamento</h3>
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Local</dt><dd className="font-medium">{clinicName}</dd></div>
          {service ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Serviço</dt><dd className="font-medium">{service.name}</dd></div> : null}
          {professional ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Profissional</dt><dd className="font-medium">{professional.name}</dd></div> : null}
          {formattedDate ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Data</dt><dd className="font-medium">{formattedDate}</dd></div> : null}
          {slot ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Horário</dt><dd className="font-medium">{slot.label}</dd></div> : null}
          {service ? <div className="flex justify-between gap-4 border-t pt-2"><dt className="text-muted-foreground">Valor estimado</dt><dd className="font-bold text-primary">{formatCurrency(service.price)}</dd></div> : null}
        </dl>
      </div>
      <FieldGroup className="gap-4">
        <Field><FieldLabel htmlFor="customerName">Nome completo</FieldLabel><Input id="customerName" name="customerName" required minLength={2} maxLength={120} autoComplete="name" disabled={isPending} placeholder="Seu nome completo" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="h-12" /></Field>
        <Field data-invalid={phoneError || undefined}><FieldLabel htmlFor="customerPhone">WhatsApp</FieldLabel><Input id="customerPhone" name="customerPhone" type="tel" required minLength={14} maxLength={16} autoComplete="tel" placeholder="(00) 00000-0000" disabled={isPending} value={phone} onChange={handlePhoneChange} onBlur={() => setPhoneError(Boolean(phone && !isValidBrazilianPhone(phone)))} aria-invalid={phoneError} aria-describedby={phoneError ? "customer-phone-description customer-phone-error" : "customer-phone-description"} className="h-12" /><FieldDescription id="customer-phone-description">Usado pelo estabelecimento para identificar e entrar em contato com você.</FieldDescription>{phoneError ? <FieldError id="customer-phone-error">Informe um WhatsApp válido com DDD.</FieldError> : null}</Field>
        <Field><FieldLabel htmlFor="customerEmail">E-mail (opcional)</FieldLabel><Input id="customerEmail" name="customerEmail" type="email" autoComplete="email" disabled={isPending} placeholder="seu@email.com" className="h-12" /></Field>
        <Field><FieldLabel htmlFor="notes">Observações (opcional)</FieldLabel><Textarea id="notes" name="notes" maxLength={2000} disabled={isPending} placeholder="Alguma observação para o profissional?" /></Field>
      </FieldGroup>
    </div>
  );
}
