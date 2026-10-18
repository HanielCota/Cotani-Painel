import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

/** Recarrega as listas afetadas por uma action; se falhar, avisa sem desfazer o que foi salvo. */
export async function refreshQueries(
  queryClient: QueryClient,
  queryKey: QueryKey,
  failureMessage: string,
): Promise<void> {
  try {
    await queryClient.invalidateQueries({ queryKey });
  } catch {
    toast.error(failureMessage);
  }
}
