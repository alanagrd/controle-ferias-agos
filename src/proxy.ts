import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Subdomínio dedicado ao Portal do Colaborador. Nesse host só existe a área
// /colaborador — qualquer outra rota (telas de ADM, login de ADM) é
// redirecionada para o login do colaborador. O ADM continua acessível pelo
// domínio principal do sistema.
const PORTAL_HOSTS = new Set(["portal.agosservicos.com.br"]);

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (
    PORTAL_HOSTS.has(host) &&
    !request.nextUrl.pathname.startsWith("/colaborador")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/colaborador/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
