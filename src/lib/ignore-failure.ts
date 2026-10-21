import { getErrorMetadata } from "@/lib/error-metadata";
import { logger } from "@/lib/logger";

/**
 * Aguarda uma tarefa secundária e não deixa a falha interromper o fluxo
 * principal (ex.: apagar a imagem antiga depois de salvar a nova). A falha
 * fica registrada como aviso com a descrição informada.
 */
export async function ignoreFailure(task: Promise<unknown>, description: string): Promise<void> {
  try {
    await task;
  } catch (error) {
    logger.warn(description, getErrorMetadata(error));
  }
}

/** Lê o corpo JSON de uma resposta; corpo vazio ou inválido vira `null`. */
export async function readJsonOrNull<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
