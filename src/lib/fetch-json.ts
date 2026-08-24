/**
 * Wrapper de fetch para as APIs privadas do painel.
 *
 * Intercepta o caso de sessão expirada: as rotas protegidas redirecionam
 * (307) para /sign-in, e o fetch segue o redirect recebendo HTML. Sem este
 * guard, o .json() quebraria com erro de parse e a tela mostraria um estado
 * de erro genérico em vez de levar o usuário ao login.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  const contentType = response.headers.get("content-type") ?? "";

  if (response.redirected || contentType.includes("text/html")) {
    if (typeof window !== "undefined") {
      // Este utilitário roda fora da árvore React; a troca completa garante a limpeza da sessão expirada.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/sign-in";
    }

    throw new Error("Sessão expirada. Redirecionando para o login.");
  }

  if (!response.ok) {
    throw new Error(`Falha na requisição (${response.status}).`);
  }

  return response.json() as Promise<T>;
}
