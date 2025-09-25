// app/layout.tsx
import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
            <Link href="/" className="font-semibold">Pedidos MP</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/materiales" className="hover:underline">Materiales</Link>
              <Link href="/pedidos" className="hover:underline">Pedidos</Link>
              <Link href="/inventario" className="hover:underline">Inventario</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}


