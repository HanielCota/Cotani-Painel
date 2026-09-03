export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("O corpo da requisição excede o limite permitido.");
    this.name = "RequestBodyTooLargeError";
  }
}

/** Lê um corpo HTTP impondo o limite durante o streaming, inclusive sem Content-Length. */
export async function readRequestText(request: Request, maxBytes: number): Promise<string> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
