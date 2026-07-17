import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  // Contas são provisionadas via API do Clerk após o pagamento — não há sign-up
  // público. routing="path" é necessário para que OAuth (Google) funcione
  // corretamente, pois o fluxo social exige redirects completos de URL.
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-10">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/acesso-negado"
        fallbackRedirectUrl="/dashboard"
        appearance={{ elements: { footerAction: "hidden" } }}
      />
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        O acesso é liberado após a contratação do plano. Use o e-mail e senha do convite ou sua conta Google.
      </p>
    </main>
  );
}
