"use client"

import { useState } from "react"
import { UploadIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface FileUploadProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  title?: string
  description?: string
  compact?: boolean
  onFileChange?: (file: File | null) => void
}

export function FileUpload({ id, title = "Escolher arquivo", description, compact = false, className, onFileChange, disabled, ...props }: FileUploadProps) {
  const [fileName, setFileName] = useState("")

  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background/55 px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20", compact && "min-h-9 rounded-lg px-3 py-2", disabled && "cursor-not-allowed opacity-50", className)}>
      <UploadIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <strong className="block truncate font-medium text-foreground">{fileName || title}</strong>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <input
        id={id}
        type="file"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          setFileName(file?.name ?? "")
          onFileChange?.(file)
        }}
        {...props}
      />
    </label>
  )
}
