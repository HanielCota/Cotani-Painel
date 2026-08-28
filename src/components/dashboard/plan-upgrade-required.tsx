import Link from "next/link";
import { LockKeyholeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlanUpgradeRequiredProps {
  feature: string;
  requiredPlan?: string;
}

export function PlanUpgradeRequired({ feature, requiredPlan = "Profissional" }: PlanUpgradeRequiredProps) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyholeIcon className="size-5" />
        </div>
        <CardTitle>{feature} não está incluído no seu plano</CardTitle>
        <CardDescription>Faça upgrade para o plano {requiredPlan} para liberar esta funcionalidade.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button nativeButton={false} render={<Link href="/dashboard/assinatura" />}>Ver planos</Button>
      </CardContent>
    </Card>
  );
}
