import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminLogin = path === "/login";
  const isColabLogin = path === "/colaborador/login";
  const isColabArea = path.startsWith("/colaborador");

  // Sem sessão: manda para o login da área correspondente (admin x colaborador).
  if (!user) {
    if (isAdminLogin || isColabLogin) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = isColabArea ? "/colaborador/login" : "/login";
    return NextResponse.redirect(url);
  }

  // Com sessão numa tela de login: sai dela. O layout de cada área faz o
  // ajuste fino de papel (admin em área de colaborador e vice-versa).
  if (isAdminLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  if (isColabLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/colaborador/holerites";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
