import { cn } from "@/lib/utils"

export function AuthCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-lg dark:shadow-none", className)} {...props} />
}
