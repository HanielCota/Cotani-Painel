import { SignIn } from "@clerk/nextjs";
import { MailIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignInPage() {
  // Contas são provisionadas via API do Clerk após o pagamento — não há sign-up
  // público. routing="hash" mantém to fluxo dentro desta rota e footerAction
  // oculto remove o link "Create account" da UI.
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="w-full max-w-sm">
        <Alert variant="default" className="border-primary/20 bg-primary/5 text-foreground">
          <MailIcon className="size-4 text-primary" />
          <AlertTitle>Acesso por convite</AlertTitle>
          <AlertDescription>
            O Cotani é invite-only. Sua conta é criada quando você contrata o plano e clica no convite enviado por e-mail.
          </AlertDescription>
        </Alert>
      </div>

      <Card className="w-full max-w-sm border-border/80 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Entrar no Cotani</CardTitle>
          <CardDescription>Use o e-mail e a senha definidos no convite.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignIn
            routing="hash"
            fallbackRedirectUrl="/dashboard"
            appearance={{ elements: { footerAction: "hidden" } }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
