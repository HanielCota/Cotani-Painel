"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteOwnAccount } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };

export function DeleteAccountForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteOwnAccount, initial);

  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") {
      toast.success(state.message);
      router.replace("/sign-in");
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Para excluir, transfira antes a administração das empresas e digite <strong className="text-foreground">EXCLUIR MINHA CONTA</strong>.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input name="confirmation" aria-label="Confirmação para excluir a conta" autoComplete="off" />
        <Button type="submit" variant="destructive" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Excluindo..." : "Excluir minha conta"}
        </Button>
      </div>
    </form>
  );
}
