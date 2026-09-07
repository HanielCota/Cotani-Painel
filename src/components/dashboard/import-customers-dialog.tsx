"use client";

import { useActionState, useState } from "react";
import { importCustomersFromCsv } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { FileUpload } from "@/components/ui/file-upload";

const initial: ActionResult = { status: "success", message: "" };
export function ImportCustomersButton() {
  const [fileName, setFileName] = useState("");
  const [state, action, pending] = useActionState(importCustomersFromCsv, initial);
  useActionFeedback(state);
  return <form action={action} className="flex flex-wrap items-center gap-2"><FileUpload id="customers-csv" name="file" accept=".csv,text/csv" required compact disabled={pending} title="Escolher CSV" onFileChange={(file) => setFileName(file?.name ?? "")} /><Button type="submit" disabled={pending||!fileName}>{pending ? "Importando..." : "Importar clientes"}</Button></form>;
}
