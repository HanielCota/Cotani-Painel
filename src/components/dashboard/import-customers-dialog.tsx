"use client";

import { useActionState, useEffect } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { importCustomersFromCsv } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };
export function ImportCustomersButton() {
  const [state, action, pending] = useActionState(importCustomersFromCsv, initial);
  useEffect(() => { if (state.message) state.status === "success" ? toast.success(state.message) : toast.error(state.message); }, [state]);
  return <form action={action} className="flex items-center gap-2"><Input name="file" type="file" accept=".csv,text/csv" required className="max-w-52" aria-label="Arquivo CSV de clientes" /><Button type="submit" variant="outline" disabled={pending}><UploadIcon />{pending ? "Importando..." : "Importar"}</Button></form>;
}
