import { CalendarCheckIcon } from "lucide-react";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function SignInPage() {
  return (
    <main id="main-content" tabIndex={-1} className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10 outline-none">
      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <CalendarCheckIcon aria-hidden="true" className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Cotani</h1>
            <p className="text-sm text-muted-foreground">Gestão simples para sua loja</p>
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-[25rem] w-full rounded-2xl border border-border/80" aria-label="Carregando formulário de acesso" />}>
          <AuthForm />
        </Suspense>
        <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Crie sua conta para iniciar o período grátis ou use o e-mail do convite da sua equipe.
        </p>
      </div>
    </main>
  );
}
