"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { Bell, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/toastprovider";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
};

type MaterialRow = {
  id: string;
  nombre: string;
  cobertura: number | null;
};

export default function HomePage() {
  const router = useRouter();
  const { notify } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [materialesCriticos, setMaterialesCriticos] = useState<MaterialRow[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function cargarPedidos() {
    const { data } = await supabase
      .from("pedidos")
      .select("id,fecha_pedido,fecha_entrega,solicitante,estado,total_bultos,total_kg")
      .eq("estado", "enviado")
      .order("fecha_pedido", { ascending: false })
      .limit(5);
    setPedidos(data ?? []);
  }

  async function marcarCompletado(id: string) {
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "completado" })
      .eq("id", id);

    if (error) {
      notify("Error al completar pedido: " + error.message, "error");
    } else {
      // en el home solo muestras pedidos pendientes (estado=enviado)
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      notify("Pedido completado ✅", "success");
    }
  }

  async function cargarInventario() {
    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,tasa_consumo_diaria_kg");

    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("material_id,kg,tipo");

    const stock: Record<string, number> = {};
    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      stock[mv.material_id] = (stock[mv.material_id] ?? 0) + Number(mv.kg) * mult;
    });

    const criticos =
      mats
        ?.map((m) => {
          const s = stock[m.id] ?? 0;
          const cobertura =
            m.tasa_consumo_diaria_kg && m.tasa_consumo_diaria_kg > 0
              ? s / m.tasa_consumo_diaria_kg
              : null;
          return { id: m.id, nombre: m.nombre, cobertura };
        })
        .filter((m) => m.cobertura !== null) ?? [];

    setMaterialesCriticos(criticos);
  }

  useEffect(() => {
    void cargarPedidos();
    void cargarInventario();
  }, []);

  useEffect(() => {
    if (materialesCriticos.length > 0) {
      setUnreadCount(materialesCriticos.filter((m) => m.cobertura! < 4).length);
    }
  }, [materialesCriticos]);

  const criticos = materialesCriticos.filter((m) => m.cobertura! < 2).length;
  const alerta = materialesCriticos.filter((m) => m.cobertura! >= 2 && m.cobertura! < 4).length;
  const seguros = materialesCriticos.filter((m) => m.cobertura! >= 4).length;

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-6">
      {/* Header con campana */}
      <header className="flex items-center justify-between bg-white rounded-xl border p-4 shadow-sm">
        <h1 className="text-2xl font-bold">📊 Dashboard</h1>
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              if (!notifOpen) setUnreadCount(0);
            }}
            className="relative rounded-full p-2 hover:bg-gray-100"
          >
            <Bell className="h-6 w-6 text-gray-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg text-sm z-10">
              <div className="px-4 py-2 border-b font-semibold text-gray-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Materiales críticos
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {materialesCriticos.filter((m) => m.cobertura! < 4).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 p-3 hover:bg-gray-50"
                  >
                    <span className="font-medium">{m.nombre}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.cobertura! < 2
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {fmtNum(m.cobertura ?? 0)} días
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* Resumen global de inventario */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Resumen de inventario</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-red-700">{criticos}</p>
            <p className="text-sm text-red-600">Críticos</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-yellow-700">{alerta}</p>
            <p className="text-sm text-yellow-600">En alerta</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">{seguros}</p>
            <p className="text-sm text-green-600">Seguros</p>
          </div>
        </div>
      </section>

      {/* Pedidos pendientes */}
      <section className="bg-white shadow-sm rounded-xl border p-4">
        <h2 className="text-lg font-semibold mb-3">
          Pedidos pendientes ({pedidos.length})
        </h2>
        {pedidos.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-center">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2">Fecha pedido</th>
                  <th className="p-2">Fecha entrega</th>
                  <th className="p-2">Solicitante</th>
                  <th className="p-2">Totales</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{p.fecha_pedido?.slice(0, 10)}</td>
                    <td className="p-2">{p.fecha_entrega ? p.fecha_entrega.slice(0, 10) : "—"}</td>
                    <td className="p-2">{p.solicitante ?? "—"}</td>
                    <td className="p-2">
                      {fmtNum(p.total_bultos ?? 0)} b / {fmtNum(p.total_kg ?? 0)} kg
                    </td>
                    <td className="p-2 flex justify-center gap-2">
                      <button
                        onClick={() => router.push(`/pedidos/${p.id}/ver`)}
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-100"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => marcarCompletado(p.id)}
                        className="rounded-lg bg-green-600 text-white px-3 py-1 text-sm hover:bg-green-700"
                      >
                        Completar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No hay pedidos pendientes.</p>
        )}
      </section>
    </main>
  );
}
