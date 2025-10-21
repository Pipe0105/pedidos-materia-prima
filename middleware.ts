import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben estar definidas para ejecutar el middleware de autenticación."
  );
}


export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient(
    { req, res },
    {
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY,
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const pathname = req.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth");
  const isAuthPage = pathname === "/auth/login";
  const isAdminPage = pathname.startsWith("/admin");
  // 🔹 Si no hay sesión permitir cualquier ruta bajo /auth (login + APIs)
  if (!session && !isAuthRoute) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    return NextResponse.redirect(redirectUrl);
  }

  // 🔹 Si hay sesión y quiere ir al login → redirigir al home
  if (session && isAuthPage) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  // 🔹 Si está en /admin pero no es admin → redirigir al home
  if (session && isAdminPage) {
    const role =
      (session.user.user_metadata?.role as string | undefined) ??
      (session.user.app_metadata?.role as string | undefined) ??
      "user";
    if (role !== "admin") {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
