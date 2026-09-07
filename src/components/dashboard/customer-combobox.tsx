"use client";

import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

interface CustomerComboboxProps {
  customers: Array<{ id: string; name: string }>;
  defaultCustomerId?: string;
  disabled?: boolean;
}

interface CustomerOption {
  value: string;
  label: string;
}

export function CustomerCombobox({ customers, defaultCustomerId = "", disabled = false }: CustomerComboboxProps) {
  const items = useMemo<CustomerOption[]>(
    () => customers.map((customer) => ({ value: customer.id, label: customer.name })),
    [customers],
  );
  const defaultValue = items.find((item) => item.value === defaultCustomerId) ?? null;

  return (
    <Combobox.Root
      items={items}
      name="customerId"
      defaultValue={defaultValue}
      disabled={disabled}
      required
      autoHighlight
    >
      <Combobox.InputGroup className="flex h-10 w-full items-center rounded-lg border border-input bg-background/70 ring-offset-background transition-[border-color,background-color,box-shadow] hover:border-foreground/25 focus-within:border-ring focus-within:bg-background focus-within:ring-3 focus-within:ring-ring/40">
        <Combobox.Input
          id="customerId"
          placeholder="Busque ou selecione um cliente"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Combobox.Trigger
          type="button"
          aria-label="Abrir lista de clientes"
          className="flex h-full w-10 shrink-0 items-center justify-center text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronDownIcon className="size-4 opacity-60" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
          className="z-50 w-[var(--anchor-width)]"
        >
          <Combobox.Popup className="max-h-[min(20rem,var(--available-height))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md transition-[opacity,transform] duration-100 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 scroll-py-1">
              {(item: CustomerOption, index: number) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  index={index}
                  className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pr-3 pl-8 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Combobox.ItemIndicator className="absolute left-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                  <span className="truncate">{item.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
