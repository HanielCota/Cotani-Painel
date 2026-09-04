import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { matchesBearerSecret } from "@/lib/secure-compare";
import { reconcileMercadoPagoSubscriptions } from "@/server/services/subscription-reconciliation";

async function dispatch(request: NextRequest) {
  const secret = z.string().min(1).safeParse(process.env.CRON_SECRET);
  if (!secret.success) return NextResponse.json({ message: "CRON_SECRET não configurado." }, { status: 500 });
  if (!matchesBearerSecret(request.headers.get("authorization"), secret.data)) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const result = await reconcileMercadoPagoSubscriptions();
  return NextResponse.json(result, { status: result.failed > 0 ? 503 : 200 });
}

export const GET = dispatch;
export const POST = dispatch;
export const maxDuration = 60;
