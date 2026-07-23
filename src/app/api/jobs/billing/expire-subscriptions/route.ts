import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { expireSubscriptions } from "@/server/services/billing";

const cronSecretSchema = z.string().min(1);

async function dispatch(request: NextRequest) {
  const parsedSecret = cronSecretSchema.safeParse(process.env.CRON_SECRET);

  if (!parsedSecret.success) {
    return NextResponse.json({ message: "CRON_SECRET não está configurado." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${parsedSecret.data}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const result = await expireSubscriptions();

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return dispatch(request);
}

export async function POST(request: NextRequest) {
  return dispatch(request);
}
