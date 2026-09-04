"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const themes = [
  { value: "system", label: "Sistema", icon: MonitorIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
] as const;

export function AccountThemeSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  return (
    <div className="flex flex-wrap gap-2" aria-label="Escolher aparência">
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
  );
}
