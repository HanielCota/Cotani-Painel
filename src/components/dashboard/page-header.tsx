import { NotificationBell } from "@/components/dashboard/notification-bell";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-w-0 w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
        <NotificationBell />
        {actions ? <div className="min-w-0 flex-1 lg:flex-none">{actions}</div> : null}
      </div>
    </header>
  );
}
