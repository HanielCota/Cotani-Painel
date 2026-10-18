import { NextResponse } from "next/server";

import { cronJob } from "@/server/cron-job";
import { reconcileMercadoPagoSubscriptions } from "@/server/services/subscription-reconciliation";

export const { GET, POST } = cronJob({
  operation: "subscription-reconciliation",
  run: async () => {
    const result = await reconcileMercadoPagoSubscriptions();
    return NextResponse.json(result, { status: result.failed > 0 ? 503 : 200 });
  },
});

export const maxDuration = 60;
