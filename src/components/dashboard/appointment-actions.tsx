"use client";

import { BanIcon, CheckIcon, CircleOffIcon, EllipsisVerticalIcon, UserRoundXIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  getAllowedAppointmentTransitions,
  isTerminalAppointmentStatus,
  paymentMethodLabels,
  type AppointmentStatusValue,
  type NextAppointmentStatus,
  type PaymentMethodValue,
} from "@/lib/appointment-status";
import type { ActionResult } from "@/types";
import { actionConfirmations, useAppointmentActions, type ActionConfirmation } from "./use-appointment-actions";

interface AppointmentActionsProps {
  appointmentId: string;
  status: AppointmentStatusValue;
  /** Início do atendimento; concluir/registrar falta só aparecem depois dele. */
  startTime?: string;
}

interface ActionOption {
  label: string;
  icon: typeof CheckIcon;
  destructive?: boolean;
}

interface ActionsDropdownProps {
  actions: NextAppointmentStatus[];
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (nextStatus: NextAppointmentStatus) => void;
}

interface StatusConfirmationDialogProps {
  open: boolean;
  confirmation: ActionConfirmation | null | undefined;
  result: ActionResult | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

interface CompleteAppointmentDialogProps {
  open: boolean;
  paymentMethod: PaymentMethodValue | "";
  result: ActionResult | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentMethodChange: (method: PaymentMethodValue) => void;
  onComplete: () => void;
}

const actionOptions: Record<NextAppointmentStatus, ActionOption> = {
  CONFIRMED: { label: "Confirmar", icon: CheckIcon },
  COMPLETED: { label: "Concluir", icon: CheckIcon },
  CANCELED: { label: "Cancelar", icon: BanIcon, destructive: true },
  NO_SHOW: { label: "Não compareceu", icon: UserRoundXIcon, destructive: true },
};

const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethodValue[];

function getErrorMessage(result: ActionResult | null) {
  if (result?.status !== "error") return null;
  return result.message || null;
}

function ActionsDropdown({ actions, open, isPending, onOpenChange, onSelect }: ActionsDropdownProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        type="button"
        disabled={isPending}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Ações
        {isPending ? <Spinner className="ml-1 size-3.5" /> : <EllipsisVerticalIcon className="ml-1 size-3.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {actions.map((nextStatus) => {
          const action = actionOptions[nextStatus];
          const Icon = action.icon;

          return (
            <DropdownMenuItem
              key={nextStatus}
              onClick={() => onSelect(nextStatus)}
              className={action.destructive ? "whitespace-nowrap text-destructive focus:text-destructive" : "whitespace-nowrap"}
              disabled={isPending}
            >
              <Icon className="mr-2 size-4" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionResultAlert({ result }: { result: ActionResult | null }) {
  if (!result?.message) return null;

  return (
    <Alert variant={result.status === "error" ? "destructive" : "default"} className="max-w-sm py-1.5">
      <CircleOffIcon aria-hidden="true" />
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}

function StatusConfirmationDialog(props: StatusConfirmationDialogProps) {
  const { open, confirmation, isPending } = props;
  const errorMessage = getErrorMessage(props.result);

  return (
    <AlertDialog open={open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Voltar
          </AlertDialogCancel>
          <Button variant="destructive" disabled={isPending || !open} onClick={props.onConfirm}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {confirmation?.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PaymentMethodSelect({ value, onChange }: { value: PaymentMethodValue | ""; onChange: (method: PaymentMethodValue) => void }) {
  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as PaymentMethodValue)} items={paymentMethodLabels}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione o método de pagamento" />
      </SelectTrigger>
      <SelectContent>
        {paymentMethods.map((method) => (
          <SelectItem key={method} value={method}>
            {paymentMethodLabels[method]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CompleteAppointmentDialog(props: CompleteAppointmentDialogProps) {
  const errorMessage = getErrorMessage(props.result);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir atendimento</DialogTitle>
          <DialogDescription>Informe como o cliente pagou para finalizar o atendimento.</DialogDescription>
        </DialogHeader>

        <PaymentMethodSelect value={props.paymentMethod} onChange={props.onPaymentMethodChange} />

        {errorMessage ? (
          <Alert variant="destructive" className="py-1.5">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter showCloseButton>
          <Button onClick={props.onComplete} disabled={props.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {props.isPending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AppointmentActions({ appointmentId, status, startTime }: AppointmentActionsProps) {
  const appointmentActions = useAppointmentActions(appointmentId);

  if (isTerminalAppointmentStatus(status)) {
    return null;
  }

  // Sem `startTime` (ex.: listas antigas) exibe todas; o servidor valida de qualquer forma.
  const actions = getAllowedAppointmentTransitions(status, startTime ?? new Date(0));
  const { result, isPending, confirmationStatus } = appointmentActions;
  const confirmation = confirmationStatus ? actionConfirmations[confirmationStatus] : null;

  return (
    <div className="flex flex-col items-end gap-2">
      <ActionsDropdown
        actions={actions}
        open={appointmentActions.dropdownOpen}
        isPending={isPending}
        onOpenChange={appointmentActions.setDropdownOpen}
        onSelect={appointmentActions.handleStatusChange}
      />

      {confirmationStatus ? null : <ActionResultAlert result={result} />}

      <StatusConfirmationDialog
        open={confirmationStatus !== null}
        confirmation={confirmation}
        result={result}
        isPending={isPending}
        onOpenChange={appointmentActions.handleConfirmationOpenChange}
        onConfirm={appointmentActions.confirmPendingStatus}
      />

      <CompleteAppointmentDialog
        open={appointmentActions.completeDialogOpen}
        paymentMethod={appointmentActions.paymentMethod}
        result={result}
        isPending={isPending}
        onOpenChange={appointmentActions.setCompleteDialogOpen}
        onPaymentMethodChange={appointmentActions.setPaymentMethod}
        onComplete={appointmentActions.handleComplete}
      />
    </div>
  );
}
