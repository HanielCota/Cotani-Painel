"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { importCustomersFromCsv } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };
export function ImportCustomersButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [state, action, pending] = useActionState(importCustomersFromCsv, initial);
  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
  return <form action={action} className="flex flex-wrap items-center gap-2"><input ref={fileRef} name="file" type="file" accept=".csv,text/csv" required className="sr-only" aria-label="Arquivo CSV de clientes" onChange={(event)=>setFileName(event.target.files?.[0]?.name??"")} /><Button type="button" variant="outline" disabled={pending} onClick={()=>fileRef.current?.click()}><UploadIcon />Escolher CSV</Button><span className="max-w-52 truncate text-sm text-muted-foreground">{fileName||"Nenhum arquivo escolhido"}</span><Button type="submit" disabled={pending||!fileName}>{pending ? "Importando..." : "Importar clientes"}</Button></form>;
}
