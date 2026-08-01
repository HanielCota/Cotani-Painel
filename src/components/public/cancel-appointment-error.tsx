import { CalendarCheckIcon, CalendarX2Icon, ClockIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface CancelAppointmentErrorProps {
  clinicName: string;
  clinicSlug: string;
  variant: "already-canceled" | "expired";
}

export function CancelAppointmentError({ clinicName, clinicSlug, variant }: CancelAppointmentErrorProps) {
  const isExpired = variant === "expired";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col items-center justify-center overflow-x-hidden px-4 py-10">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {isExpired ? <ClockIcon /> : <CalendarX2Icon />}
          </EmptyMedia>
          <EmptyTitle>
            {isExpired ? "Este agendamento já expirou" : "Este agendamento já foi cancelado"}
          </EmptyTitle>
          <EmptyDescription>
            {isExpired
              ? `O horário do atendimento em ${clinicName} já passou, por isso não é mais possível cancelá-lo pelo link.`
              : `O agendamento em ${clinicName} já foi cancelado anteriormente e o horário foi liberado.`}
          </EmptyDescription>
        </EmptyHeader>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button nativeButton={false} render={<Link href={`/${clinicSlug}`} />} className="h-12 w-full">
            <CalendarCheckIcon aria-hidden="true" className="mr-2 size-4" />
            Fazer novo agendamento
          </Button>
        </div>
      </Empty>
    </main>
  );
}
