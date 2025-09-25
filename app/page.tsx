// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pedidos Materia Prima</h1>
      <p className="text-gray-600">Elige una sección:</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/materiales" className="rounded-lg border px-4 py-2 hover:bg-gray-50">Materiales</Link>
        <Link href="/pedidos" className="rounded-lg border px-4 py-2 hover:bg-gray-50">Pedidos</Link>
      </div>
    </div>
  );
}
