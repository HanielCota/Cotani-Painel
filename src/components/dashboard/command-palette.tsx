"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlusIcon, ContactRoundIcon, CornerDownLeftIcon, SearchIcon, type LucideIcon } from "lucide-react";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import type { NavigationSection } from "@/config/dashboard-navigation";
import { fetchJson } from "@/lib/fetch-json";
import { isMacPlatform, isTypingTarget, NEW_APPOINTMENT_PARAM, normalizeSearch, requestNewAppointment } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import type { CustomersPage } from "@/types";

interface PaletteItem {
  id: string;
  group: "Ações" | "Páginas" | "Clientes";
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

interface CommandPaletteProps {
  sections: readonly NavigationSection[];
  canCreateAppointment: boolean;
  canSearchCustomers: boolean;
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd data-slot="kbd" className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}

const subscribeNothing = () => () => undefined;

/** Item "Buscar" da sidebar + paleta de comandos (Ctrl/⌘+K) e o atalho "N" de novo atendimento. */
export function CommandPalette({ sections, canCreateAppointment, canSearchCustomers }: CommandPaletteProps) {
  const router = useRouter();
  const clinicId = useActiveClinicId();
  const { isMobile, setOpenMobile } = useSidebar();
  const isMac = useSyncExternalStore(subscribeNothing, isMacPlatform, () => false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  function go(href: string) {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
    router.push(href);
  }

  function newAppointment() {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
    // Na agenda o diálogo atende na hora; fora dela, a agenda abre com ele aberto.
    if (!requestNewAppointment()) router.push(`/dashboard/agenda?${NEW_APPOINTMENT_PARAM}=1`);
  }

  // Atalhos globais. Ctrl/⌘+K vale até digitando; "N" só fora de campos.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (open || event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTypingTarget(event.target)) return;
      if (canCreateAppointment && event.key.toLowerCase() === "n" && !document.querySelector("[role=dialog]")) {
        event.preventDefault();
        if (!requestNewAppointment()) router.push(`/dashboard/agenda?${NEW_APPOINTMENT_PARAM}=1`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canCreateAppointment, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const customersQuery = useQuery({
    queryKey: ["customers", clinicId, "palette", debouncedQuery],
    queryFn: () => fetchJson<CustomersPage>(`/api/customers?${new URLSearchParams({ search: debouncedQuery, pageSize: "5" })}`),
    enabled: open && canSearchCustomers && debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const needle = normalizeSearch(query);
  const matches = (label: string) => !needle || normalizeSearch(label).includes(needle);

  const items: PaletteItem[] = [
    ...(canCreateAppointment && matches("Novo atendimento")
      ? [{ id: "action:new-appointment", group: "Ações" as const, label: "Novo atendimento", hint: "N", icon: CalendarPlusIcon, run: newAppointment }]
      : []),
    ...sections.flatMap((section) =>
      section.items
        .filter((item) => matches(item.title))
        .map((item) => ({ id: `page:${item.href}`, group: "Páginas" as const, label: item.title, hint: section.title, icon: item.icon, run: () => go(item.href) })),
    ),
    // Só resultados da busca atual (durante o atraso de 200 ms, nada da anterior).
    ...(debouncedQuery === query.trim() ? customersQuery.data?.items ?? [] : []).map((customer) => ({
      id: `customer:${customer.id}`,
      group: "Clientes" as const,
      label: customer.name,
      hint: customer.phone,
      icon: ContactRoundIcon,
      run: () => go(`/dashboard/clientes/${customer.id}`),
    })),
  ];
  const selected = Math.min(activeIndex, Math.max(items.length - 1, 0));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const next = (selected + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      setActiveIndex(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[selected]?.run();
    }
  }

  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  return (
    <>
      <SidebarMenuButton onClick={() => setOpen(true)} tooltip={`Buscar (${shortcutLabel})`} className="h-9">
        <SearchIcon />
        <span className="truncate">Buscar</span>
        <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">{shortcutLabel}</Kbd>
      </SidebarMenuButton>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Buscar no painel</DialogTitle>
          <DialogDescription className="sr-only">Digite para filtrar páginas, ações e clientes. Use as setas e Enter.</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border/70 px-4">
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={canSearchCustomers ? "Buscar página, ação ou cliente..." : "Buscar página ou ação..."}
              aria-label="Buscar"
              aria-controls="command-palette-list"
              aria-activedescendant={items[selected] ? `command-${items[selected].id}` : undefined}
              role="combobox"
              aria-expanded="true"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
          </div>

          <ul id="command-palette-list" ref={listRef} role="listbox" aria-label="Resultados" className="max-h-[min(24rem,60svh)] overflow-y-auto overscroll-contain p-2">
            {items.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                {customersQuery.isFetching ? "Buscando clientes..." : "Nada encontrado."}
              </li>
            ) : (
              items.map((item, index) => {
                const Icon = item.icon;
                const startsGroup = index === 0 || items[index - 1].group !== item.group;
                return (
                  <li key={item.id} role="presentation">
                    {startsGroup ? <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{item.group}</p> : null}
                    <button
                      id={`command-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === selected}
                      data-index={index}
                      tabIndex={-1}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={item.run}
                      className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none", index === selected && "bg-accent text-accent-foreground")}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.group === "Ações" && item.hint ? <Kbd>{item.hint}</Kbd> : item.hint ? <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center gap-4 border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navegar</span>
            <span className="flex items-center gap-1.5"><Kbd><CornerDownLeftIcon aria-hidden="true" className="size-3" /></Kbd> abrir</span>
            <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> fechar</span>
            {canCreateAppointment ? <span className="ml-auto hidden items-center gap-1.5 sm:flex"><Kbd>N</Kbd> novo atendimento</span> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
