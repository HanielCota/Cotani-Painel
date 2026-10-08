import { NextResponse } from "next/server";

import { cronJob } from "@/server/cron-job";
import { expireSubscriptions } from "@/server/services/billing";

export const { GET, POST } = cronJob({
  operation: "subscription-expiry",
  run: async () => NextResponse.json(await expireSubscriptions()),
});
