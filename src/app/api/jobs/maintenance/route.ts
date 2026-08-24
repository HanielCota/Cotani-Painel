import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { runDataMaintenance } from "@/server/services/maintenance";

async function dispatch(request: NextRequest) {
  const secret = z.string().min(1).safeParse(process.env.CRON_SECRET);
  if (!secret.success) return NextResponse.json({ message: "CRON_SECRET não configurado." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret.data}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json(await runDataMaintenance());
}

export const GET = dispatch;
export const POST = dispatch;
