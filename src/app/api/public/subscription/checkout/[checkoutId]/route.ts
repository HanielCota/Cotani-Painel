import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedLandingOrigin, landingCorsHeaders } from "@/lib/landing-cors";
import { getLandingCheckoutStatus } from "@/server/services/landing-checkout";

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: landingCorsHeaders(request) });
}

export function OPTIONS(request: NextRequest) {
  if (!isAllowedLandingOrigin(request)) return json(request, { message: "Origem não permitida." }, 403);
  return new NextResponse(null, { status: 204, headers: landingCorsHeaders(request) });
}

export async function GET(request: NextRequest, context: { params: Promise<{ checkoutId: string }> }) {
  if (!isAllowedLandingOrigin(request)) return json(request, { message: "Origem não permitida." }, 403);
  const parsed = z.uuid().safeParse((await context.params).checkoutId);
  if (!parsed.success) return json(request, { message: "Checkout inválido." }, 400);
  const status = await getLandingCheckoutStatus(parsed.data);
  if (!status) return json(request, { message: "Checkout não encontrado." }, 404);
  return json(request, { status });
}
