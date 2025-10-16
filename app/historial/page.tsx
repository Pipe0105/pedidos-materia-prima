"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterPanel } from "./components/filter-panel";
import { FilterSummary } from "./components/filter-summary";
import { HistorialEmptyState } from "./components/empty-state";
import { HistorialLoading } from "./components/loading-placeholder";
import { HistorialSummary } from "./summary";
import { PedidosTable } from "./components/pedidos-table";
import { Pedido } from "./types";

type Zona = {
  id: string;
  nombre: string;
};

type PedidoSupabase = Omit<Pedido, "zonas" | "pedido_items"> & {
  zonas: { nombre: string | null }[] | { nombre: string | null } | null;
  pedido_items:
    | {
        bultos: number | null;
        kg: number | null;
        materiales: {
          nombre: string;
          unidad_medida: "bulto" | "unidad" | "litro";
        } | null;
      }[]
    | null;
};

export default function HistorialPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  // filtros
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      const pedidosRes = await supabase
        .from("pedidos")
        .select(
          `
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
        `
        )
        .or("estado.eq.completado,cancelado_at.not.is.null")
        .order("fecha_pedido", { ascending: false });

      const zonasRes = await supabase
        .from("zonas")
        .select("id, nombre")
        .eq("activo", true);

      if (pedidosRes.error) {
        console.error("Error cargando historial:", pedidosRes.error);
      } else {
        const pedidosData = (pedidosRes.data ?? []) as PedidoSupabase[];
        const pedidosLimpios: Pedido[] = pedidosData.map((pedido) => ({
          ...pedido,
          zonas: Array.isArray(pedido.zonas)
            ? { nombre: pedido.zonas[0]?.nombre ?? null }
            : pedido.zonas ?? { nombre: null },
          pedido_items: Array.isArray(pedido.pedido_items)
            ? pedido.pedido_items
            : [],
        }));

        setPedidos(pedidosLimpios);
      }

      if (zonasRes.error) {
        console.error("Error cargando zonas:", zonasRes.error);
      } else {
        const zonasOrdenadas = (zonasRes.data ?? [])
          .filter((zona) => zona.nombre !== "Inventario General")
          .sort((a, b) => {
            const ordenPreferido = ["Desposte", "Desprese", "Panificadora"];
            const aIndex = ordenPreferido.indexOf(a.nombre);
            const bIndex = ordenPreferido.indexOf(b.nombre);
            return (
              (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
              (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
            );
          });

        setZonas(zonasOrdenadas);
      }

      setLoading(false);
    }

    void cargarDatos();
  }, []);

  useEffect(() => {
    if (!zonas.length) {
      setActiveTab("");
      return;
    }

    setActiveTab((prev) => {
      if (prev && zonas.some((zona) => zona.id === prev)) {
        return prev;
      }
      return zonas[0].id;
    });
  }, [zonas]);

  const filtrados = useMemo(() => {
    return pedidos
      .filter((pedido) =>
        q
          ? (pedido.solicitante ?? "").toLowerCase().includes(q.toLowerCase())
          : true
      )
      .filter((pedido) =>
        desde ? new Date(pedido.fecha_pedido) >= new Date(desde) : true
      )
      .filter((pedido) =>
        hasta ? new Date(pedido.fecha_pedido) <= new Date(hasta) : true
      );
  }, [pedidos, q, desde, hasta]);

  const filtrosActivos = [
    q
      ? {
          label: "Solicitante",
          value: q,
          onRemove: () => setQ(""),
        }
      : null,
    desde
      ? {
          label: "Desde",
          value: desde,
          onRemove: () => setDesde(""),
        }
      : null,
    hasta
      ? {
          label: "Hasta",
          value: hasta,
          onRemove: () => setHasta(""),
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    value: string;
    onRemove: () => void;
  }[];

  const currentTab = activeTab || (zonas.length ? zonas[0].id : "");

  function aplicarRango(desdeValue: string, hastaValue: string) {
    setDesde(desdeValue);
    setHasta(hastaValue);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Historial de pedidos
          </h1>
          <p className="text-sm text-slate-500">
            Consulta el histórico por zona y obtén contexto del estado actual.
          </p>
        </div>
      </header>

      <FilterPanel
        q={q}
        desde={desde}
        hasta={hasta}
        onChangeQ={setQ}
        onChangeDesde={setDesde}
        onChangeHasta={setHasta}
        onApplyRange={aplicarRango}
      />

      <FilterSummary
        filters={filtrosActivos}
        onClearAll={() => {
          setQ("");
          setDesde("");
          setHasta("");
        }}
      />

      {loading ? (
        <HistorialLoading />
      ) : zonas.length ? (
        <section className="space-y-6">
          <HistorialSummary pedidos={filtrados} desde={desde} hasta={hasta} />

          <Tabs
            value={currentTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="flex w-full gap-2 overflow-x-auto rounded-full bg-slate-100 p-1">
              {zonas.map((zona) => (
                <TabsTrigger
                  key={zona.id}
                  value={zona.id}
                  className="whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-500"
                >
                  {zona.nombre}
                </TabsTrigger>
              ))}
            </TabsList>

            {zonas.map((zona) => {
              const pedidosZona = filtrados.filter(
                (pedido) => pedido.zona_id === zona.id
              );

              return (
                <TabsContent
                  key={zona.id}
                  value={zona.id}
                  className="space-y-4"
                >
                  {pedidosZona.length ? (
                    <PedidosTable pedidos={pedidosZona} />
                  ) : (
                    <HistorialEmptyState
                      title="No hay pedidos para esta zona"
                      description="Prueba ajustando los filtros o consulta otro periodo para ver pedidos registrados."
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </section>
      ) : (
        <HistorialEmptyState
          title="Todavía no hay zonas activas"
          description="Cuando registres pedidos en una zona activa aparecerán aquí para su seguimiento."
          showAction
        />
      )}
    </main>
  );
}
