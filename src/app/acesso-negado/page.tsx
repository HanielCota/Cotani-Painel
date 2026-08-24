import type { Metadata } from "next";
import { LockKeyholeIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Acesso negado" };

export default function AccessDeniedPage() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,oklch(0.91_0.08_165_/_0.45),transparent_68%)]" />
      <Card className="relative w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><LockKeyholeIcon className="size-5" /></span>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            O Cotani só pode ser acessado por convite após a contratação do plano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
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
