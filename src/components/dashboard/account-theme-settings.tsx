"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SparklesIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ACCENTS, applyAppearance, readStoredAppearance, storeAppearance, SURFACES, type AccentChoice, type Surface } from "@/lib/appearance";
import { cn } from "@/lib/utils";

const themes = [
  { value: "system", label: "Sistema", icon: MonitorIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
] as const;

// Estado compartilhado das escolhas (fonte: localStorage), lido via useSyncExternalStore.
const listeners = new Set<() => void>();
let snapshot: ReturnType<typeof readStoredAppearance> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  snapshot ??= readStoredAppearance();
  return snapshot;
}

function update(next: { surface: Surface; accent: AccentChoice }) {
  snapshot = next;
  storeAppearance(next.surface, next.accent);
  applyAppearance(next.surface, next.accent);
  listeners.forEach((listener) => listener());
}

interface SwatchProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  color: string | null;
  /** Amostra clara: o ícone de selecionado fica escuro. */
  pale?: boolean;
}

function Swatch({ label, selected, onSelect, color, pale = false }: SwatchProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="group flex w-16 flex-col items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
          selected ? "ring-2 ring-foreground" : "ring-1 ring-border group-hover:ring-foreground/40",
          color === null && "bg-muted text-muted-foreground",
        )}
        style={color ? { backgroundColor: color } : undefined}
      >
        {selected ? <CheckIcon aria-hidden="true" className={cn("size-4", color === null ? "text-foreground" : pale ? "text-black/80" : "text-white")} /> : color === null ? <SparklesIcon aria-hidden="true" className="size-4" /> : null}
      </span>
      <span className={cn("text-xs", selected ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
    </button>
  );
}

export function AccountThemeSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const appearance = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return (
    <div className="flex flex-col gap-6">
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
        <p className="text-sm font-medium">Tema de fundo</p>
        <p className="text-xs text-muted-foreground">Tom do painel: fundo, cartões e barra lateral.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tema de fundo">
          {SURFACES.map((option) => (
            <Swatch
              key={option.value}
              label={option.label}
              color={option.swatch}
              pale={option.value !== "grafite"}
              selected={appearance?.surface === option.value}
              onSelect={() => update({ surface: option.value, accent: appearance?.accent ?? "verde" })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Cor de destaque</p>
        <p className="text-xs text-muted-foreground">Botões, ícones e itens selecionados. &quot;Automática&quot; combina com o tema de fundo.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor de destaque">
          {ACCENTS.map((option) => (
            <Swatch
              key={option.value}
              label={option.label}
              color={option.swatch}
              selected={appearance?.accent === option.value}
              onSelect={() => update({ surface: appearance?.surface ?? "neutro", accent: option.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
