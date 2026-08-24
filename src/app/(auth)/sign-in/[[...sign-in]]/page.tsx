import { SignIn } from "@clerk/nextjs";
import { CalendarCheckIcon } from "lucide-react";

export default function SignInPage() {
  // Contas são provisionadas via API do Clerk após o pagamento — não há sign-up
  // público. routing="path" é necessário para que OAuth (Google) funcione
  // corretamente, pois o fluxo social exige redirects completos de URL.
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
            <p className="text-sm text-muted-foreground">Gestão simples para sua barbearia</p>
          </div>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/acesso-negado"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              footerAction: "hidden",
              cardBox: "shadow-lg",
              card: "rounded-2xl border border-border/80",
              headerTitle: "text-foreground",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
            },
          }}
        />
        <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          O acesso é liberado após a contratação do plano. Use o e-mail e a senha do convite ou sua conta Google.
        </p>
      </div>
    </main>
  );
}
