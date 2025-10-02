"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { useToast } from "@/components/toastprovider";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
};

export default function PedidosZona({
  zonaId,
  nombre,
}: {
  zonaId: string;
  nombre: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<Pedido["estado"] | "">("");
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  async function cargarPedidos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg"
      )
      .eq("zona_id", zonaId)
      .order("fecha_pedido", { ascending: false });

    if (error) {
      notify("Error cargando pedidos: " + error.message, "error");
    } else {
      setPedidos(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void cargarPedidos();
  }, [zonaId]);

  const filtrados = useMemo(() => {
    return pedidos
      .filter((p) =>
        q ? (p.solicitante ?? "").toLowerCase().includes(q.toLowerCase()) : true
      )
      .filter((p) => (estadoFiltro ? p.estado === estadoFiltro : true))
      .filter((p) => (mostrarCompletados ? true : p.estado !== "completado"));
  }, [pedidos, q, estadoFiltro, mostrarCompletados]);

  async function eliminarPedido(id: string) {
    if (!confirm("¿Eliminar este pedido?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) {
      notify("Error al eliminar pedido: " + error.message, "error");
    } else {
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      notify("Pedido eliminado ✅", "success");
    }
  }

  async function duplicarPedido(id: string) {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        zona_id: zonaId,
        fecha_pedido: new Date().toISOString().slice(0, 10),
        fecha_entrega: pedido.fecha_entrega,
        solicitante: pedido.solicitante,
        estado: "enviado", // ✅ ahora empieza como enviado
        total_bultos: pedido.total_bultos,
        total_kg: pedido.total_kg,
      })
      .select("id")
      .single();

    if (error) {
      notify("Error al duplicar: " + error.message, "error");
    } else {
      notify("Pedido duplicado ✅", "success");
      router.push(`/pedidos/${data!.id}`);
    }
  }

  async function marcarCompletado(id: string) {
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "completado" })
      .eq("id", id);

    if (error) {
      notify("Error al completar pedido: " + error.message, "error");
    } else {
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, estado: "completado" } : p
        )
      );
      notify("Pedido completado ✅", "success");
    }
  }

  function badgeEstado(estado: Pedido["estado"]) {
    const base =
      "px-3 py-1 rounded-full text-xs font-semibold inline-block";
    switch (estado) {
      case "enviado":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            Enviado
          </span>
        );
      case "recibido":
        return (
          <span className={`${base} bg-yellow-100 text-yellow-700`}>
            Recibido
          </span>
        );
      case "completado":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            Completado
          </span>
        );
    }
  }

  return (
    <main className="space-y-6 p-4">
      {/* Encabezado */}
      <header className="space-y-1">
        <h2 className="text-2xl font-bold">Pedidos – {nombre}</h2>
        <p className="text-gray-500 text-sm">
          Aquí puedes gestionar los pedidos de la planta {nombre}.
        </p>
      </header>

      {/* Filtros y botón */}
      <div className="border rounded-lg bg-gray-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Input búsqueda */}
            <div className="relative">
              <span className="absolute left-2 top-2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Buscar por solicitante…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-7 rounded-lg border px-3 py-1 text-sm"
              />
            </div>

            {/* Select estado */}
            <select
              className="rounded-lg border px-3 py-1 text-sm"
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="enviado">Enviado</option>
              <option value="recibido">Recibido</option>
              <option value="completado">Completado</option>
            </select>

            {/* Checkbox completados */}
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={mostrarCompletados}
                onChange={(e) => setMostrarCompletados(e.target.checked)}
              />
              Mostrar completados
            </label>
          </div>

          {/* Botón nuevo pedido */}
          <button
            onClick={() => router.push("/pedidos/nuevo")}
            className="flex items-center gap-1 rounded bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700"
          >
            ➕ Nuevo pedido
          </button>
        </div>
      </div>

      {/* Tabla o estado vacío */}
      {loading ? (
        <p className="text-gray-500">Cargando pedidos…</p>
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
                    {p.estado !== "completado" && (
                      <button
                        onClick={() => marcarCompletado(p.id)}
                        className="rounded-lg bg-green-600 text-white px-2 py-1 text-xs hover:bg-green-700"
                      >
                        Completar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 p-10">
          <p className="text-lg mb-2">📄 No hay pedidos registrados</p>
          <p className="text-sm mb-4">
            Comienza creando un nuevo pedido para esta planta.
          </p>
          <button
            onClick={() => router.push("/pedidos/nuevo")}
            className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
          >
            ➕ Crear pedido
          </button>
        </div>
      )}
    </main>
  );
}
