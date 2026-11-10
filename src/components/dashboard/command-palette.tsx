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
import {
  isMacPlatform,
  isTypingTarget,
  NEW_APPOINTMENT_PARAM,
  normalizeSearch,
  requestNewAppointment,
} from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import type { CustomerListItem, CustomersPage } from "@/types";

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

type AppRouter = ReturnType<typeof useRouter>;

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

const subscribeNothing = () => () => undefined;

/** Na agenda o diálogo atende na hora; fora dela, a agenda abre com ele aberto. */
function openNewAppointment(router: AppRouter) {
  if (requestNewAppointment()) return;

  router.push(`/dashboard/agenda?${NEW_APPOINTMENT_PARAM}=1`);
}

function isToggleShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k";
}

function shouldIgnoreShortcut(event: KeyboardEvent, open: boolean) {
  return open || event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTypingTarget(event.target);
}

/** Atalhos globais. Ctrl/⌘+K vale até digitando; "N" só fora de campos. */
function useGlobalShortcuts(open: boolean, setOpen: (update: (current: boolean) => boolean) => void, canCreateAppointment: boolean) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isToggleShortcut(event)) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (shouldIgnoreShortcut(event, open)) return;
      if (canCreateAppointment && event.key.toLowerCase() === "n" && !document.querySelector("[role=dialog]")) {
        event.preventDefault();
        openNewAppointment(router);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canCreateAppointment, router, setOpen]);
}

/** Item "Buscar" da sidebar + paleta de comandos (Ctrl/⌘+K) e o atalho "N" de novo atendimento. */
export function CommandPalette({ sections, canCreateAppointment, canSearchCustomers }: CommandPaletteProps) {
  const isMac = useSyncExternalStore(subscribeNothing, isMacPlatform, () => false);
  const [open, setOpen] = useState(false);
  useGlobalShortcuts(open, setOpen, canCreateAppointment);

  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  return (
    <>
      <SidebarMenuButton onClick={() => setOpen(true)} tooltip={`Buscar (${shortcutLabel})`} className="h-9">
        <SearchIcon />
        <span className="truncate">Buscar</span>
        <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">{shortcutLabel}</Kbd>
      </SidebarMenuButton>

      <CommandPaletteDialog
        open={open}
        setOpen={setOpen}
        sections={sections}
        canCreateAppointment={canCreateAppointment}
        canSearchCustomers={canSearchCustomers}
      />
    </>
  );
}

function usePaletteNavigation(setOpen: (open: boolean) => void) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  function closePalette() {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
  }

  function go(href: string) {
    closePalette();
    router.push(href);
  }

  function newAppointment() {
    closePalette();
    openNewAppointment(router);
  }

  return { go, newAppointment };
}

function useDebouncedTrimmedQuery(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  return debouncedQuery;
}

function usePaletteCustomers({ open, canSearchCustomers, query }: { open: boolean; canSearchCustomers: boolean; query: string }) {
  const clinicId = useActiveClinicId();
  const debouncedQuery = useDebouncedTrimmedQuery(query);
  const customersQuery = useQuery({
    queryKey: ["customers", clinicId, "palette", debouncedQuery],
    queryFn: () =>
      fetchJson<CustomersPage>(`/api/customers?${new URLSearchParams({ search: debouncedQuery, pageSize: "5" })}`),
    enabled: open && canSearchCustomers && debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  // Só resultados da busca atual (durante o atraso de 200 ms, nada da anterior).
  const customers = debouncedQuery === query.trim() ? (customersQuery.data?.items ?? []) : [];

  return { customers, isFetching: customersQuery.isFetching };
}

interface PaletteItemsInput {
  query: string;
  sections: readonly NavigationSection[];
  canCreateAppointment: boolean;
  customers: CustomerListItem[];
  go: (href: string) => void;
  newAppointment: () => void;
}

function buildPaletteItems({ query, sections, canCreateAppointment, customers, go, newAppointment }: PaletteItemsInput): PaletteItem[] {
  const needle = normalizeSearch(query);
  const matches = (label: string) => !needle || normalizeSearch(label).includes(needle);

  const actionItems: PaletteItem[] = canCreateAppointment && matches("Novo atendimento")
    ? [{ id: "action:new-appointment", group: "Ações", label: "Novo atendimento", hint: "N", icon: CalendarPlusIcon, run: newAppointment }]
    : [];
  const pageItems: PaletteItem[] = sections.flatMap((section) =>
    section.items
      .filter((item) => matches(item.title))
      .map((item) => ({
        id: `page:${item.href}`,
        group: "Páginas" as const,
        label: item.title,
        hint: section.title,
        icon: item.icon,
        run: () => go(item.href),
      })),
  );
  const customerItems: PaletteItem[] = customers.map((customer) => ({
    id: `customer:${customer.id}`,
    group: "Clientes",
    label: customer.name,
    hint: customer.phone,
    icon: ContactRoundIcon,
    run: () => go(`/dashboard/clientes/${customer.id}`),
  }));

  return [...actionItems, ...pageItems, ...customerItems];
}

function nextActiveIndex(selected: number, key: string, itemCount: number) {
  return (selected + (key === "ArrowDown" ? 1 : -1) + itemCount) % itemCount;
}

function usePaletteSelection(items: PaletteItem[]) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = Math.min(activeIndex, Math.max(items.length - 1, 0));

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      items[selected]?.run();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    if (items.length === 0) return;

    const next = nextActiveIndex(selected, event.key, items.length);
    setActiveIndex(next);
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  }

  return { selected, setActiveIndex, listRef, handleInputKeyDown };
}

interface CommandPaletteDialogProps extends CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

function CommandPaletteDialog({ open, setOpen, sections, canCreateAppointment, canSearchCustomers }: CommandPaletteDialogProps) {
  const [query, setQuery] = useState("");
  const { go, newAppointment } = usePaletteNavigation(setOpen);
  const { customers, isFetching } = usePaletteCustomers({ open, canSearchCustomers, query });
  const items = buildPaletteItems({ query, sections, canCreateAppointment, customers, go, newAppointment });
  const { selected, setActiveIndex, listRef, handleInputKeyDown } = usePaletteSelection(items);
  const selectedItem = items[selected];

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;

    setQuery("");
    setActiveIndex(0);
  }

  function changeQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Buscar no painel</DialogTitle>
        <DialogDescription className="sr-only">
          Digite para filtrar páginas, ações e clientes. Use as setas e Enter.
        </DialogDescription>
        <PaletteSearchInput
          query={query}
          onQueryChange={changeQuery}
          onKeyDown={handleInputKeyDown}
          canSearchCustomers={canSearchCustomers}
          activeDescendantId={selectedItem ? `command-${selectedItem.id}` : undefined}
        />
        <PaletteResultList items={items} selected={selected} isFetching={isFetching} listRef={listRef} onHover={setActiveIndex} />
        <PaletteFooter canCreateAppointment={canCreateAppointment} />
      </DialogContent>
    </Dialog>
  );
}

interface PaletteSearchInputProps {
  query: string;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  canSearchCustomers: boolean;
  activeDescendantId: string | undefined;
}

function PaletteSearchInput({ query, onQueryChange, onKeyDown, canSearchCustomers, activeDescendantId }: PaletteSearchInputProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border/70 px-4">
      <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <input
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={canSearchCustomers ? "Buscar página, ação ou cliente..." : "Buscar página ou ação..."}
        aria-label="Buscar"
        aria-controls="command-palette-list"
        aria-activedescendant={activeDescendantId}
        role="combobox"
        aria-expanded="true"
        className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
    </div>
  );
}

interface PaletteResultListProps {
  items: PaletteItem[];
  selected: number;
  isFetching: boolean;
  listRef: React.RefObject<HTMLUListElement | null>;
  onHover: (index: number) => void;
}

function PaletteResultList({ items, selected, isFetching, listRef, onHover }: PaletteResultListProps) {
  return (
    <ul
      id="command-palette-list"
      ref={listRef}
      role="listbox"
      aria-label="Resultados"
      className="max-h-[min(24rem,60svh)] overflow-y-auto overscroll-contain p-2"
    >
      {items.length === 0 ? (
        <li className="px-3 py-8 text-center text-sm text-muted-foreground">
          {isFetching ? "Buscando clientes..." : "Nada encontrado."}
        </li>
      ) : (
        items.map((item, index) => (
          <PaletteOption
            key={item.id}
            item={item}
            index={index}
            isSelected={index === selected}
            startsGroup={index === 0 || items[index - 1].group !== item.group}
            onHover={onHover}
          />
        ))
      )}
    </ul>
  );
}

interface PaletteOptionProps {
  item: PaletteItem;
  index: number;
  isSelected: boolean;
  startsGroup: boolean;
  onHover: (index: number) => void;
}

function PaletteOption({ item, index, isSelected, startsGroup, onHover }: PaletteOptionProps) {
  const Icon = item.icon;

  return (
    <li role="presentation">
      {startsGroup ? (
        <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{item.group}</p>
      ) : null}
      <button
        id={`command-${item.id}`}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-index={index}
        tabIndex={-1}
        onMouseMove={() => onHover(index)}
        onClick={item.run}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none",
          isSelected && "bg-accent text-accent-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <PaletteOptionHint group={item.group} hint={item.hint} />
      </button>
    </li>
  );
}

function PaletteOptionHint({ group, hint }: { group: PaletteItem["group"]; hint: string | undefined }) {
  if (!hint) return null;
  if (group === "Ações") return <Kbd>{hint}</Kbd>;

  return <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>;
}

function PaletteFooter({ canCreateAppointment }: { canCreateAppointment: boolean }) {
  return (
    <div className="flex items-center gap-4 border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> navegar
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>
          <CornerDownLeftIcon aria-hidden="true" className="size-3" />
        </Kbd>{" "}
        abrir
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Esc</Kbd> fechar
      </span>
      {canCreateAppointment ? (
        <span className="ml-auto hidden items-center gap-1.5 sm:flex">
          <Kbd>N</Kbd> novo atendimento
        </span>
      ) : null}
    </div>
  );
}
