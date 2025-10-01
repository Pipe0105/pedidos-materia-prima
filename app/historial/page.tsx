"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  cancelado_at?: string | null;
};

export default function HistorialPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  async function cargarPedidos() {
    setLoading(true);

    let query = supabase
      .from("pedidos")
      .select(
        "id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, cancelado_at"
      )
      .or("estado.eq.completado,cancelado_at.not.is.null")
      .order("fecha_pedido", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error cargando historial:", error);
    } else {
      setPedidos(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void cargarPedidos();
  }, []);

  const filtrados = useMemo(() => {
    return pedidos
      .filter((p) =>
        q ? (p.solicitante ?? "").toLowerCase().includes(q.toLowerCase()) : true
      )
      .filter((p) =>
        desde ? new Date(p.fecha_pedido) >= new Date(desde) : true
      )
      .filter((p) =>
        hasta ? new Date(p.fecha_pedido) <= new Date(hasta) : true
      );
  }, [pedidos, q, desde, hasta]);

  function badgeEstado(p: Pedido) {
    const base = "px-2 py-0.5 rounded text-xs font-medium";
    if (p.cancelado_at) {
      return <span className={`${base} bg-rose-100 text-rose-700`}>Cancelado</span>;
    }
    if (p.estado === "completado") {
      return (
        <span className={`${base} bg-emerald-100 text-emerald-700`}>
          Completado
        </span>
      );
    }
    return <span className={`${base} bg-gray-100 text-gray-600`}>{p.estado}</span>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Historial de pedidos</h1>
      </header>

      {/* filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar por solicitante…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-lg border px-2 py-1 text-sm"
        />
        <label className="text-sm">
          Desde:{" "}
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          Hasta:{" "}
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border px-2 py-1 text-sm"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando historial…</p>
      ) : filtrados.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm text-center">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2">Fecha pedido</th>
                <th className="p-2">Fecha entrega</th>
                <th className="p-2">Solicitante</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Totales</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{p.fecha_pedido?.slice(0, 10)}</td>
                  <td className="p-2">
                    {p.fecha_entrega ? p.fecha_entrega.slice(0, 10) : "—"}
                  </td>
                  <td className="p-2">{p.solicitante ?? "—"}</td>
                  <td className="p-2">{badgeEstado(p)}</td>
                  <td className="p-2">
                    {fmtNum(p.total_bultos ?? 0)} b / {fmtNum(p.total_kg ?? 0)} kg
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => router.push(`/pedidos/${p.id}/ver`)}
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No hay pedidos en el historial.</p>
      )}
    </main>
  );
}
