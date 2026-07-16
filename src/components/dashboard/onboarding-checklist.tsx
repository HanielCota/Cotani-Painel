import Link from "next/link";
import { CheckIcon, ClockIcon, LinkIcon, ScissorsIcon, SettingsIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface OnboardingChecklistProps {
  bookingUrl: string;
  hasServices: boolean;
  hasBusinessHours: boolean;
  isSubscriptionActive: boolean;
}

export function OnboardingChecklist({
  bookingUrl,
  hasServices,
  hasBusinessHours,
  isSubscriptionActive,
}: OnboardingChecklistProps) {
  const steps = [
    {
      id: "subscription",
      label: "Assinatura ativa",
      description: "Renove o plano para liberar agendamentos e configurações.",
      done: isSubscriptionActive,
      href: "#",
      icon: TriangleAlertIcon,
      external: true,
    },
    {
      id: "business-hours",
      label: "Definir expediente",
      description: "Informe os dias e horários de funcionamento.",
      done: hasBusinessHours,
      href: "/dashboard/configuracoes",
      icon: ClockIcon,
    },
    {
      id: "services",
      label: "Cadastrar serviços",
      description: "Adicione cortes, barba e outros serviços com preço e duração.",
      done: hasServices,
      href: "/dashboard/configuracoes",
      icon: ScissorsIcon,
    },
    {
      id: "link",
      label: "Divulgar link de agendamento",
      description: "Copie o link e publique no Instagram, WhatsApp ou site.",
      done: false,
      href: bookingUrl,
      icon: LinkIcon,
      external: true,
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SettingsIcon className="size-4 text-primary" />
          Primeiros passos
        </CardTitle>
        <CardDescription>
          Complete as configurações para começar a receber agendamentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="font-medium">{completedCount}</span>
          <span className="text-muted-foreground">de {steps.length} concluídos</span>
          <div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <li
                key={step.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${step.done ? "bg-muted/30" : "bg-card"}`}
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                    step.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step.done ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {step.external ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={step.href} target="_blank" rel="noopener noreferrer" />}
                  >
                    <LinkIcon className="mr-1.5 size-3.5" />
                    Abrir
                  </Button>
                ) : (
                  <Button
                    variant={step.done ? "outline" : "default"}
                    size="sm"
                    nativeButton={false}
                    render={<Link href={step.href} />}
                  >
                    {step.done ? "Revisar" : "Configurar"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
