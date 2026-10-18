import { NextResponse } from "next/server";

import { cronJob } from "@/server/cron-job";
import { dispatchDueNotifications, type DispatchStats } from "@/server/services/notification-dispatcher";
import { readJsonOrNull } from "@/lib/ignore-failure";

/**
 * Dispatcher da fila de notificações, acionado pelo cron (Bearer CRON_SECRET).
 * A regra de envio fica em `server/services/notification-dispatcher.ts`.
 */
export const { GET, POST } = cronJob({
  operation: "notification-dispatch",
  run: async () => NextResponse.json(await dispatchDueNotifications()),
  outcome: async (response) => {
    if (response.status === 401) return null;
    const body = await readJsonOrNull<Partial<DispatchStats>>(response.clone());
    const failed = typeof body?.failed === "number" ? body.failed : 0;
    const status = response.status >= 500 ? "FAILURE" : failed > 0 ? "WARNING" : "SUCCESS";
    return {
      status,
      summary: {
        httpStatus: response.status,
        claimed: body?.claimed ?? 0,
        sent: body?.sent ?? 0,
        retried: body?.retried ?? 0,
        failed,
      },
      ...(status === "FAILURE" ? { error: `A tarefa retornou HTTP ${response.status}.` } : {}),
    };
  },
});
