import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Acesso negado" };

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            O Cotani só pode ser acessado por convite após a contratação do plano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Se você já é cliente, use o link do convite enviado por e-mail. Novas contas só podem ser criadas no
            momento da contratação do plano.
          </p>
        </CardContent>
        <CardFooter>
          <Button nativeButton={false} render={<Link href="/sign-in" />} variant="outline" className="w-full">
            Voltar para o login
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
