import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface FeaturePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function FeaturePlaceholder({ title, description, icon: Icon }: FeaturePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="border border-dashed border-border/90 bg-card/80 shadow-sm">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon />
          </div>
          <CardTitle>Disponível em breve</CardTitle>
          <CardDescription>Esta funcionalidade ainda não está liberada no Cotani.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Enquanto isso, você pode acompanhar e organizar os atendimentos pela Agenda.
        </CardContent>
        <CardFooter>
          <Button nativeButton={false} render={<Link href="/dashboard/agenda" />} variant="outline">Abrir agenda</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
