import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  // Contas são provisionadas via API do Clerk após o pagamento — não há sign-up
  // público. routing="hash" mantém todo o fluxo dentro desta rota e footerAction
  // oculto remove o link "Create account" da UI.
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-10">
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/dashboard"
        appearance={{ elements: { footerAction: "hidden" } }}
      />
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        O acesso é liberado por convite. Se você ainda não recebeu um, entre em contato.
      </p>
    </main>
  );
}
