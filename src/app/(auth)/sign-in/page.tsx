import Image from "next/image";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function SignInPage() {
  return (
    <main id="main-content" tabIndex={-1} className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10 outline-none">
      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/images/cotani-favicon.png" alt="" width={64} height={64} priority className="size-16" />
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
