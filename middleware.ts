import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname.toLowerCase();

  // Bloquea el acceso a pconsumo y redirige a inventario.
  if (pathname.startsWith("/pconsumo")) {
    return NextResponse.redirect(new URL("/inventario", req.url));
  }

  // Mientras la autenticacion no sea necesaria, dejamos pasar todas las solicitudes.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
