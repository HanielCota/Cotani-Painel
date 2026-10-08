import { NextResponse } from "next/server";

import { cronJob } from "@/server/cron-job";
import { runDataMaintenance } from "@/server/services/maintenance";

export const { GET, POST } = cronJob({
  operation: "data-maintenance",
  run: async () => NextResponse.json(await runDataMaintenance()),
});
