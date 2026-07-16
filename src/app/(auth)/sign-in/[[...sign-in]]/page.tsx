import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  // Contas são provisionadas via API do Clerk após o pagamento — não há sign-up
  // público. routing="hash" mantém todo o fluxo dentro desta rota e footerAction
  // oculto remove o link "Create account" da UI.
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/dashboard"
        appearance={{ elements: { footerAction: "hidden" } }}
      />
    </main>
  );
}
