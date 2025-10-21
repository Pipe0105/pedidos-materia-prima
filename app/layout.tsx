// app/layout.tsx
"use client";

import "./globals.css";
import Link from "next/link";
import { ToastProvider } from "@/components/toastprovider";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname.startsWith("/auth/login");

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <html lang="es">
      <body>
        <ToastProvider>
          {!esLogin && (
            <header className="border-b bg-white">
              <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
                <Link href="/" className="font-semibold">
                  Pedidos MP
                </Link>
                <div className="flex gap-4 text-sm items-center">
                  <Link href="/materiales" className="hover:underline">
                    Materiales
                  </Link>
                  <Link href="/pedidos" className="hover:underline">
                    Pedidos
                  </Link>
                  <Link href="/inventario" className="hover:underline">
                    Inventario
                  </Link>
                  <Link href="/historial" className="hover:underline">
                    Historial
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded bg-rose-600 text-white px-3 py-1 text-sm"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </nav>
            </header>
          )}
          <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
