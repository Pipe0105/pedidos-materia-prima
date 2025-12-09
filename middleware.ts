import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export function middleware(_req: NextRequest) {
  // Mientras la autenticación no sea necesaria, dejamos pasar todas las
  // solicitudes sin redirigir a la página de login.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
