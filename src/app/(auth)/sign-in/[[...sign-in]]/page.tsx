import { CalendarCheckIcon } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,oklch(0.91_0.08_165_/_0.55),transparent_68%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <CalendarCheckIcon className="size-6" />
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight">Cotani</p>
            <p className="text-sm text-muted-foreground">Gestão simples para sua loja</p>
          </div>
        </div>
        <AuthForm />
        <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Crie sua conta para iniciar o período grátis ou use o e-mail do convite da sua equipe.
        </p>
      </div>
    </main>
  );
}
