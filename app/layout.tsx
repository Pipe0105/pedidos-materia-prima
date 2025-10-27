"use client";

import { useState } from "react";
import "./globals.css";
import Link from "next/link";
import { ToastProvider } from "@/components/toastprovider";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Menu, X } from "lucide-react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname.startsWith("/auth/login");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/materiales", label: "Materiales" },
    { href: "/pedidos", label: "Pedidos" },
    { href: "/inventario", label: "Inventario" },
    { href: "/historial", label: "Historial" },
  ];

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
              <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
                <Link
                  href="/"
                  className="font-semibold text-slate-900 text-base "
                >
                  Pedidos MP
                </Link>
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="hidden items-center gap-4 text-sm sm:flex">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-md px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:hidden"
                    aria-expanded={mobileMenuOpen}
                    aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                  >
                    {mobileMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </nav>
              <div
                className="mx-auto w-full max-w-6xl px-4 pb-4 sm:hidden"
                hidden={!mobileMenuOpen}
              >
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void handleLogout();
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </header>
          )}
          <main className="mx-auto w-full max-w-6xl px-2 py-8 sm:px-4 lg:px-6">
            {children}
          </main>{" "}
        </ToastProvider>
      </body>
    </html>
  );
}
