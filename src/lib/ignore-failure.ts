/**
 * Aguarda uma tarefa secundária e descarta a falha de propósito (ex.: apagar
 * a imagem antiga depois de salvar a nova). Use só quando a falha não deve
 * interromper o fluxo principal.
 */
export async function ignoreFailure(task: Promise<unknown>): Promise<void> {
  try {
    await task;
  } catch {
    // Falha secundária: o fluxo principal já foi concluído.
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
