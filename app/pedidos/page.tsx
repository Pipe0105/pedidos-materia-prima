"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import Link from "next/link";
import { show2 } from "@/lib/math";

type Pedido = {
  id: string;
  fecha_pedido: string; // YYYY-MM-DD
  solicitante: string | null;
  estado: "borrador" | "enviado" | "completado";
};

export default function PedidosPage() {
  const [zonaId, setZonaId] = useState<string>("");
  const [rows, setRows] = useState<
    (Pedido & { total_bultos: number; total_kg: number })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  async function cargar(zid: string) {
    if (!zid) return;
    setLoading(true);

    // 1) Traer pedidos de la zona
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id,fecha_pedido,solicitante,estado")
      .eq("zona_id", zid)
      .order("fecha_pedido", { ascending: false })
      .returns<Pedido[]>();

    // 2) Totales desde items (cliente)
    const ids = (pedidos ?? []).map((p) => p.id);
    const tot: Record<string, { b: number; kg: number }> = {};
    if (ids.length) {
      const { data: it } = await supabase
        .from("pedido_items")
        .select("pedido_id,bultos,kg")
        .in("pedido_id", ids)
        .returns<{ pedido_id: string; bultos: number; kg: number }[]>();
      (it ?? []).forEach((r) => {
        tot[r.pedido_id] ??= { b: 0, kg: 0 };
        tot[r.pedido_id].b += Number(r.bultos);
        tot[r.pedido_id].kg += Number(r.kg);
      });
    }

    const data = (pedidos ?? [])
      .filter((p) => (mostrarCompletados ? true : p.estado !== "completado"))
      .map((p) => ({
        ...p,
        total_bultos: tot[p.id]?.b ?? 0,
        total_kg: tot[p.id]?.kg ?? 0,
      }));

    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    if (zonaId) void cargar(zonaId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaId, mostrarCompletados]);

  async function nuevo() {
    if (!zonaId) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("pedidos")
      .insert({ zona_id: zonaId, fecha_pedido: hoy, estado: "borrador" })
      .select("id")
      .single();
    if (!error && data) location.href = `/pedidos/${data.id}`;
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Zona:</span>
          <ZoneSelector value={zonaId} onChange={setZonaId} />
          <button onClick={nuevo} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
            + Nuevo pedido
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <label className="text-sm">
          <input
            type="checkbox"
            className="mr-2"
            checked={mostrarCompletados}
            onChange={(e) => setMostrarCompletados(e.target.checked)}
          />
          Mostrar completados
        </label>
        <button onClick={() => cargar(zonaId)} className="rounded-lg border px-3 py-1 text-sm">
          Refrescar
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-2">Fecha</th>
                <th className="p-2">Solicitante</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Totales</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{r.fecha_pedido}</td>
                  <td className="p-2">{r.solicitante ?? "—"}</td>
                  <td className="p-2">{r.estado}</td>
                  <td className="p-2">
                    {show2(r.total_bultos)} b / {show2(r.total_kg)} kg
                  </td>
                  <td className="p-2">
                    <Link className="rounded border px-2 py-1" href={`/pedidos/${r.id}`}>
                      Ver/Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={5}>
                    No hay pedidos en esta zona.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
