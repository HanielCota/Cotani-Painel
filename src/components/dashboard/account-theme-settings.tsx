"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ACCENTS, applyAccent, DEFAULT_ACCENT, isAccent, type Accent } from "@/lib/accent";
import { cn } from "@/lib/utils";

const themes = [
  { value: "system", label: "Sistema", icon: MonitorIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
] as const;

const accentListeners = new Set<() => void>();

function subscribeAccent(listener: () => void) {
  accentListeners.add(listener);
  return () => accentListeners.delete(listener);
}

function readAccent(): Accent {
  const value = document.documentElement.dataset.accent;
  return isAccent(value) ? value : DEFAULT_ACCENT;
}

function selectAccent(accent: Accent) {
  applyAccent(accent);
  accentListeners.forEach((listener) => listener());
}

export function AccountThemeSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const accent = useSyncExternalStore(subscribeAccent, readAccent, () => null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Modo</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher modo claro ou escuro">
          {themes.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant={mounted && theme === value ? "default" : "outline"}
              aria-pressed={mounted && theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">&quot;Sistema&quot; acompanha o modo do seu computador ou celular.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Cor de destaque</p>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Cor de destaque">
          {ACCENTS.map((option) => {
            const selected = accent === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectAccent(option.value)}
                className="group flex w-14 flex-col items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                    selected ? "ring-2 ring-foreground" : "ring-1 ring-border group-hover:ring-foreground/40",
                  )}
                  style={{ backgroundColor: option.swatch }}
                >
                  {selected ? <CheckIcon aria-hidden="true" className="size-4 text-white" /> : null}
                </span>
                <span className={cn("text-xs", selected ? "font-medium text-foreground" : "text-muted-foreground")}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
