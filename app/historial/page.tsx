"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  cancelado_at?: string | null;
  zona_id: string | null;
  zonas?: {
    nombre: string | null;
  } | null;
  pedido_items?: {
    bultos: number | null;
    kg: number | null;
    materiales: {
      nombre: string;
      unidad_medida: "bulto" | "unidad" | "litro";
    } | null;
  }[];
};

export default function HistorialPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [zonas, setZonas] = useState<{ id: string; nombre: string }[]>([]);
  const [activeTab, setActiveTab] = useState("");

  // filtros
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // 🔹 Cargar pedidos y zonas
useEffect(() => {
  async function cargarDatos() {
    setLoading(true);

    const pedidosRes = await supabase
      .from("pedidos")
      .select(`
        id,
        fecha_pedido,
        fecha_entrega,
        solicitante,
        estado,
        total_bultos,
        total_kg,
        cancelado_at,
        zona_id,
        zonas (nombre),
        pedido_items (
          bultos,
          kg,
          materiales (nombre, unidad_medida)
        )
      `)
      .or("estado.eq.completado,cancelado_at.not.is.null")
      .order("fecha_pedido", { ascending: false });


    const zonasRes = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true);

    // ✅ Limpieza y normalización de datos de pedidos
    if (pedidosRes.error) {
      console.error("Error cargando historial:", pedidosRes.error);
    } else {
      const pedidosLimpios: Pedido[] = (pedidosRes.data ?? []).map((p: any) => ({
        ...p,
      zonas: Array.isArray(p.zonas)
        ? { nombre: p.zonas[0]?.nombre ?? null }
        : p.zonas ?? { nombre: null },
      pedido_items: Array.isArray(p.pedido_items) ? p.pedido_items : [],
    }));

      setPedidos(pedidosLimpios);
    }

    if (zonasRes.error) {
      console.error("Error cargando zonas:", zonasRes.error);
    } else {
      const zonasOrdenadas = (zonasRes.data ?? [])
        .filter((z) => z.nombre !== "Inventario General")
        .sort((a, b) => {
          const orden = ["Desposte", "Desprese", "Panificadora"];
          return orden.indexOf(a.nombre) - orden.indexOf(b.nombre);
        });
      setZonas(zonasOrdenadas);
    }

    setLoading(false);
  }

  void cargarDatos();
}, []);


  // 🔹 Mantener tab activa válida
  useEffect(() => {
    if (!zonas.length) {
      setActiveTab("");
      return;
    }

    setActiveTab((prev) => {
      if (prev && zonas.some((z) => z.id === prev)) {
        return prev;
      }
      return zonas[0].id;
    });
  }, [zonas]);

  // 🔹 Filtros por texto y fechas
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

  // 🔹 Estado visual (badge)
  function badgeEstado(p: Pedido) {
    const base = "px-2 py-0.5 rounded text-xs font-medium";
    if (p.cancelado_at) {
      return (
        <span className={`${base} bg-rose-100 text-rose-700`}>Cancelado</span>
      );
    }
    if (p.estado === "completado") {
      return (
        <span className={`${base} bg-emerald-100 text-emerald-700`}>
          Completado
        </span>
      );
    }
    return (
      <span className={`${base} bg-gray-100 text-gray-600`}>{p.estado}</span>
    );
  }

  const currentTab = activeTab || (zonas.length ? zonas[0].id : "");

  // 🔹 Render principal
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

      {/* contenido */}
      {loading ? (
        <p className="text-gray-500">Cargando historial…</p>
      ) : zonas.length ? (
        <Tabs
          value={currentTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="flex space-x-2">
            {zonas.map((zona) => (
              <TabsTrigger
                key={zona.id}
                value={zona.id}
                className="rounded-full px-6 py-2 text-sm font-medium data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-200 data-[state=inactive]:text-gray-700"
              >
                {zona.nombre}
              </TabsTrigger>
            ))}
          </TabsList>

          {zonas.map((zona) => {
            const pedidosZona = filtrados.filter(
              (p) => p.zona_id === zona.id
            );

            return (
              <TabsContent key={zona.id} value={zona.id}>
                {pedidosZona.length ? (
                  <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <table className="min-w-full text-sm text-center">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="p-2">Fecha pedido</th>
                          <th className="p-2">Fecha entrega</th>
                          <th className="p-2">Solicitante</th>
                          <th className="p-2">Estado</th>
                          <th className="p-2">Materiales</th>
                          <th className="p-2">Totales</th>
                          <th className="p-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosZona.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="p-2">
                              {p.fecha_pedido?.slice(0, 10)}
                            </td>
                            <td className="p-2">
                              {p.fecha_entrega
                                ? p.fecha_entrega.slice(0, 10)
                                : "—"}
                            </td>
                            <td className="p-2">{p.solicitante ?? "—"}</td>
                            <td className="p-2">{badgeEstado(p)}</td>
                            <td className="p-2 text-center">
                            {p.pedido_items && p.pedido_items.length > 0 ? (
                              <ul className="text-center ">
                                {p.pedido_items.map((it, idx) => (
                                  <li key={idx}>
                                    {it.materiales?.nombre}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              "—"
                            )}
                          </td>
                            <td className="p-2">
                              {fmtNum(p.total_bultos ?? 0)} b /{" "}
                              {fmtNum(p.total_kg ?? 0)} kg
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() =>
                                  router.push(`/pedidos/${p.id}/ver`)
                                }
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
                  <p className="rounded-xl border bg-white p-6 text-center text-gray-500">
                    No hay pedidos en el historial para {zona.nombre}.
                  </p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <p className="text-gray-500">No hay pedidos en el historial.</p>
      )}
    </main>
  );
}
