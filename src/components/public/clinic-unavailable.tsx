import { CalendarX2Icon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface ClinicUnavailableProps {
  clinicName: string;
}

export function ClinicUnavailable({ clinicName }: ClinicUnavailableProps) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col items-center justify-center px-4 py-10">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon />
          </EmptyMedia>
          <EmptyTitle>{clinicName} está temporariamente indisponível</EmptyTitle>
          <EmptyDescription>
            Os agendamentos online estão suspensos no momento. Entre em contato
            diretamente com a barbearia para mais informações.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
