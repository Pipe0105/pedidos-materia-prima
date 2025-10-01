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
};

export default function PedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(""); // buscador
  const [estadoFiltro, setEstadoFiltro] = useState<Pedido["estado"] | "">("");
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  async function cargarPedidos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg"
      )
      .order("fecha_pedido", { ascending: false });

    if (error) {
      console.error("Error cargando pedidos:", error);
    } else {
      setPedidos(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void cargarPedidos();
  }, []);

  // aplicar filtros y búsqueda
  const filtrados = useMemo(() => {
    return pedidos
      .filter((p) =>
        q ? (p.solicitante ?? "").toLowerCase().includes(q.toLowerCase()) : true
      )
      .filter((p) => (estadoFiltro ? p.estado === estadoFiltro : true))
      .filter((p) =>
        mostrarCompletados ? true : p.estado !== "completado"
      );
  }, [pedidos, q, estadoFiltro, mostrarCompletados]);

  // eliminar pedido
  async function eliminarPedido(id: string) {
    if (!confirm("¿Eliminar este pedido?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar pedido:", error);
    } else {
      setPedidos((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // duplicar pedido
  async function duplicarPedido(id: string) {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        zona_id: "TODO", // ⚠️ ajusta según tu lógica
        fecha_pedido: new Date().toISOString().slice(0, 10),
        fecha_entrega: pedido.fecha_entrega,
        solicitante: pedido.solicitante,
        estado: "borrador",
        total_bultos: pedido.total_bultos,
        total_kg: pedido.total_kg,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error al duplicar:", error);
    } else {
      router.push(`/pedidos/${data!.id}`);
    }
  }

  // badge de estado
  function badgeEstado(estado: Pedido["estado"]) {
    const base = "px-2 py-0.5 rounded text-xs font-medium";
    switch (estado) {
      case "borrador":
        return <span className={`${base} bg-gray-100 text-gray-600`}>Borrador</span>;
      case "enviado":
        return <span className={`${base} bg-blue-100 text-blue-700`}>Enviado</span>;
      case "recibido":
        return <span className={`${base} bg-green-100 text-green-700`}>Recibido</span>;
      case "completado":
        return <span className={`${base} bg-emerald-100 text-emerald-700`}>Completado</span>;
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <button
          onClick={() => router.push("/pedidos/nuevo")}
          className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
        >
          Nuevo pedido
        </button>
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
        <select
          className="rounded-lg border px-2 py-1 text-sm"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as any)}
        >
          <option value="">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="enviado">Enviado</option>
          <option value="recibido">Recibido</option>
          <option value="completado">Completado</option>
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={mostrarCompletados}
            onChange={(e) => setMostrarCompletados(e.target.checked)}
          />
          Mostrar completados
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
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
                  <td className="p-2">{badgeEstado(p.estado)}</td>
                  <td className="p-2">
                    {fmtNum(p.total_bultos ?? 0)} b / {fmtNum(p.total_kg ?? 0)} kg
                  </td>
                  <td className="p-2 space-x-2">
                    <button
                      onClick={() => router.push(`/pedidos/${p.id}/ver`)}
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => router.push(`/pedidos/${p.id}`)}
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => duplicarPedido(p.id)}
                      className="rounded-lg border px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Duplicar
                    </button>
                    <button
                      onClick={() => eliminarPedido(p.id)}
                      className="rounded-lg border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No hay pedidos que coincidan.</p>
      )}
    </main>
  );
}
