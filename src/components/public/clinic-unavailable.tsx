import { CalendarX2Icon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";

interface ClinicUnavailableProps {
  clinicName: string;
}

export function ClinicUnavailable({ clinicName }: ClinicUnavailableProps) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-svh w-full max-w-2xl flex-col items-center justify-center overflow-x-hidden px-4 py-10 outline-none">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon aria-hidden="true" />
          </EmptyMedia>
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            {clinicName} está temporariamente indisponível
          </h1>
          <EmptyDescription>
            Os agendamentos online estão suspensos no momento. Entre em contato
            diretamente com a loja para mais informações.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
