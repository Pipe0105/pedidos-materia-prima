import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = req.nextUrl.pathname.startsWith("/auth/login");
  const isAdminPage = req.nextUrl.pathname.startsWith("/admin");

  // 🔹 Si no hay sesión y no es la página de login → redirigir al login
  if (!session && !isAuthPage) {
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
