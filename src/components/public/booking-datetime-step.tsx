"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { AvailabilitySlot } from "./booking-types";

interface BookingDateTimeStepProps {
  minDate: string;
  selectedDate: string;
  selectedSlot: AvailabilitySlot | null;
  slots: AvailabilitySlot[];
  isFetching: boolean;
  availableDates: Set<string>;
  isLoadingAvailableDates: boolean;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: AvailabilitySlot) => void;
  onMonthChange: (month: Date) => void;
}

export function BookingDateTimeStep({
  minDate,
  selectedDate,
  selectedSlot,
  slots,
  isFetching,
  availableDates,
  isLoadingAvailableDates,
  onDateChange,
  onSlotChange,
  onMonthChange,
}: BookingDateTimeStepProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selectedDateValue = selectedDate ? parseISO(selectedDate) : undefined;
  const minDateValue = parseISO(minDate);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      <div className="flex items-center gap-2 text-primary">
        <ClockIcon className="size-5" />
        <h2 className="text-lg font-semibold">Escolha data e horário</h2>
      </div>
      <Field>
        <FieldLabel htmlFor="booking-date">Data</FieldLabel>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                id="booking-date"
                variant="outline"
                className={`w-full justify-start font-normal ${selectedDateValue ? "" : "text-muted-foreground"}`}
              />
            }
          >
            <CalendarIcon aria-hidden="true" />
            {selectedDateValue ? format(selectedDateValue, "dd/MM/yyyy") : "Selecione uma data"}
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden p-0" align="center">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDateValue}
              onSelect={(day) => {
                if (!day) return;
                onDateChange(format(day, "yyyy-MM-dd"));
                setCalendarOpen(false);
              }}
              onMonthChange={onMonthChange}
              disabled={(day) => day < minDateValue || !availableDates.has(format(day, "yyyy-MM-dd"))}
            />
            {isLoadingAvailableDates ? (
              <p className="px-4 py-2 text-xs text-muted-foreground">Carregando dias disponíveis...</p>
            ) : null}
          </PopoverContent>
        </Popover>
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Horários disponíveis</legend>
        <div aria-live="polite" className="flex flex-wrap gap-2.5">
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Selecione uma data para ver os horários.</p>
          ) : isFetching ? (
            <div className="flex w-full flex-wrap gap-2.5">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-20 rounded-lg" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem horários disponíveis para esta data.</p>
          ) : (
            slots.map((slot, index) => {
              const selected = selectedSlot?.startTime === slot.startTime;
              return (
                <label key={slot.startTime} className="cursor-pointer">
                  <input
                    type="radio"
                    name="startTime"
                    value={slot.startTime}
                    required={index === 0}
                    checked={selected}
                    className="peer sr-only"
                    onChange={() => onSlotChange(slot)}
                  />
                  <span
                    className={`inline-flex min-h-12 items-center rounded-xl border px-5 text-sm font-medium transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring active:scale-95 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent hover:text-accent-foreground"}`}
                  >
                    {slot.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {selectedDate && !isFetching && slots.length > 0 && slots.length <= 3 ? (
          <p className="text-xs font-medium text-warning">
            Apenas {slots.length} {slots.length === 1 ? "horário disponível" : "horários disponíveis"} para este dia.
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
