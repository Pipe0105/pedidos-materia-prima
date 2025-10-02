"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmtNum } from "@/lib/format";

type Material = {
  id: string;
  nombre: string;
  unidad_medida: "bulto" | "unidad" | "litro";
  presentacion_kg_por_bulto: number | null;
};

type ComparacionRow = {
  material_id: string;
  nombre: string;
  unidad: "bulto" | "unidad" | "litro";
  stock: number;
  auto: number | null;
  manual: number | null;
  restanteAuto: number | null;
  restanteManual: number | null;
};

function formatUnidad(valor: number | null, unidad: string) {
  if (valor == null) return "—";
  const plural =
    unidad === "bulto" ? "bultos" : unidad === "unidad" ? "unidades" : "litros";
  const singular = unidad;
  return `${fmtNum(valor)} ${valor === 1 ? singular : plural}`;
}

export default function ComparacionPage() {
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<ComparacionRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    if (!zonaId || !fecha) return;
    setLoading(true);

    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,unidad_medida,presentacion_kg_por_bulto")
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();

    const { data: auto } = await supabase
      .from("consumo_auto")
      .select("material_id,kg")
      .eq("zona_id", zonaId)
      .eq("fecha", fecha);

    const { data: manual } = await supabase
      .from("consumo_manual")
      .select("material_id,kg")
      .eq("zona_id", zonaId)
      .eq("fecha", fecha);

    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("material_id,kg,tipo")
      .eq("zona_id", zonaId);

    const autoMap = new Map<string, number>();
    (auto ?? []).forEach((a) => autoMap.set(a.material_id, Number(a.kg)));

    const manualMap = new Map<string, number>();
    (manual ?? []).forEach((m) => manualMap.set(m.material_id, Number(m.kg)));

    const stockKg: Record<string, number> = {};
    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      stockKg[mv.material_id] =
        (stockKg[mv.material_id] ?? 0) + Number(mv.kg) * mult;
    });

    const data: ComparacionRow[] =
      mats?.map((m) => {
        const stKg = stockKg[m.id] ?? 0;

        // stock en unidad original
        let stock = stKg;
        if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
          stock = stKg / m.presentacion_kg_por_bulto;
        }

        // consumo automático convertido a unidad real
        let autoU: number | null = null;
        if (autoMap.has(m.id)) {
          const kg = autoMap.get(m.id)!;
          if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
            autoU = kg / m.presentacion_kg_por_bulto;
          } else {
            autoU = kg; // ya está en unidades o litros
          }
        }

        // consumo manual convertido a unidad real
        let manualU: number | null = null;
        if (manualMap.has(m.id)) {
          const kg = manualMap.get(m.id)!;
          if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
            manualU = kg / m.presentacion_kg_por_bulto;
          } else {
            manualU = kg; // ya está en unidades o litros
          }
        }

        // stock restante
        let restanteAuto: number | null = null;
        let restanteManual: number | null = null;
        if (autoU != null) restanteAuto = stock - autoU;
        if (manualU != null) restanteManual = stock - manualU;

        return {
          material_id: m.id,
          nombre: m.nombre,
          unidad: m.unidad_medida,
          stock,
          auto: autoU,
          manual: manualU,
          restanteAuto,
          restanteManual,
        };
      }) ?? [];

    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    if (zonaId) void cargar();
  }, [zonaId, fecha]);

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Comparación de Consumos</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Zona:</span>
          <ZoneSelector value={zonaId} onChange={setZonaId} />
          <input
            type="date"
            className="rounded-lg border px-2 py-1 text-sm"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <button
            onClick={cargar}
            className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Refrescar
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-gray-500">Cargando…</div>
      ) : rows.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.material_id}
              className="p-5 border rounded-xl bg-white shadow-sm"
            >
              <h2 className="text-lg font-semibold mb-3">{r.nombre}</h2>

              {/* Stock destacado */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600">Stock Actual</p>
                <p className="text-xl font-bold">
                  {formatUnidad(r.stock, r.unidad)}
                </p>
              </div>

              {/* Comparación en dos columnas */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-medium text-blue-600">Consumo Auto</p>
                  <p>{formatUnidad(r.auto, r.unidad)}</p>
                  <p className="mt-2 font-medium text-blue-600">
                    Restante Auto
                  </p>
                  <p>
                    {r.restanteAuto != null
                      ? formatUnidad(r.restanteAuto, r.unidad)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-green-600">Consumo Manual</p>
                  <p>{formatUnidad(r.manual, r.unidad)}</p>
                  <p className="mt-2 font-medium text-green-600">
                    Restante Manual
                  </p>
                  <p>
                    {r.restanteManual != null
                      ? formatUnidad(r.restanteManual, r.unidad)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500 border rounded-lg bg-gray-50">
          No hay datos para esta fecha/zona.
        </div>
      )}
    </main>
  );
}
