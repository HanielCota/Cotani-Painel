"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateAccountProfile } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types";
const initial: ActionResult = { status: "success", message: "" };

export function AccountProfileSettings({ user }: { user: { name: string; email: string | null } }) {
  const [state, action, pending] = useActionState(updateAccountProfile, initial);

  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="account-name">Nome</Label>
        <Input id="account-name" name="name" defaultValue={user.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-email">E-mail</Label>
        <Input id="account-email" name="email" type="email" defaultValue={user.email ?? ""} required />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:col-span-2 sm:w-auto sm:justify-self-end">
        {pending ? "Salvando..." : "Salvar perfil"}
      </Button>
    </form>
  );
}
