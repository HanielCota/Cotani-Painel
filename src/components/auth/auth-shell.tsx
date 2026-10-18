import { ThemeToggle } from "@/components/theme-toggle";

/** Moldura comum das telas de acesso e recuperação: brilho da marca e tema. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-svh bg-background">
      <div aria-hidden="true" className="public-page-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-96" />
      <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
