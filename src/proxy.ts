import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, request) => {
  // Apenas o painel exige sessão. As demais rotas são públicas por design:
  // /{slug} e /api/public/* (agendamento self-service), /api/webhooks/clerk,
  // /api/jobs/notifications (protegida por CRON_SECRET) e /sign-in.
  // As APIs privadas mantêm seu próprio auth.protect() (404 para não autenticados).
  // O destino do redirect é /sign-in via NEXT_PUBLIC_CLERK_SIGN_IN_URL.
  if (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin")) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
