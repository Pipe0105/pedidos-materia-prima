"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmtNum } from "@/lib/format";

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
  unidad_medida: "bulto" | "unidad" | "litro";
};

type ConsumoRow = {
  material_id: string;
  nombre: string;
  stock: number;
  consumo_diario: number | null;
  cobertura: number | null;
  hasta: string | null;
  unidad: "bulto" | "unidad" | "litro";
};

// 👉 Función para mostrar singular/plural
function formatUnidad(valor: number, unidad: "bulto" | "unidad" | "litro") {
  const plural =
    unidad === "bulto" ? "bultos" : unidad === "unidad" ? "unidades" : "litros";
  const singular = unidad;

  return `${fmtNum(valor)} ${valor === 1 ? singular : plural}`;
}

export default function InventarioPage() {
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<ConsumoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mats, setMats] = useState<Material[]>([]);

  async function cargar() {
    if (!zonaId || !fecha) return;
    setLoading(true);

    const { data: matsData } = await supabase
      .from("materiales")
      .select(
        "id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,unidad_medida"
      )
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();

    setMats(matsData ?? []);

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

    const data: ConsumoRow[] =
      matsData?.map((m: Material) => {
        const stKg = stockKg[m.id] ?? 0;

        // --- Calcular consumo diario en kg ---
        let consumoKg: number | null = null;
        if (manualMap.get(m.id)) {
          consumoKg = manualMap.get(m.id)!;
        } else if (autoMap.get(m.id)) {
          consumoKg = autoMap.get(m.id)!;
        } else if (m.tasa_consumo_diaria_kg && m.tasa_consumo_diaria_kg > 0) {
          consumoKg = m.tasa_consumo_diaria_kg;
        }

        // --- Convertir a la unidad del material ---
        let stock: number = stKg;
        let consumo_diario: number | null = consumoKg;
        if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
          stock = stKg / m.presentacion_kg_por_bulto;
          consumo_diario = consumoKg
            ? consumoKg / m.presentacion_kg_por_bulto
            : null;
        } else if (m.unidad_medida === "unidad") {
          stock = stKg; // en unidades
          consumo_diario = consumoKg ?? null;
        } else if (m.unidad_medida === "litro") {
          stock = stKg; // en litros
          consumo_diario = consumoKg ?? null;
        }

        // --- Cobertura ---
        let cobertura: number | null = null;
        let hasta: string | null = null;
        if (consumo_diario && consumo_diario > 0) {
          cobertura = stock / consumo_diario;
          const base = new Date(fecha);
          base.setDate(base.getDate() + Math.floor(cobertura));
          hasta = base.toISOString().slice(0, 10);
        }

        return {
          material_id: m.id,
          nombre: m.nombre,
          stock,
          consumo_diario,
          cobertura,
          hasta,
          unidad: m.unidad_medida,
        };
      }) ?? [];

    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    if (zonaId) void cargar();
  }, [zonaId, fecha]);

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventario y Consumos</h1>
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
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm text-center">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2">Material</th>
                <th className="p-2">Stock</th>
                <th className="p-2">Consumo diario</th>
                <th className="p-2">Cobertura</th>
                <th className="p-2">Hasta</th>
                <th className="p-2">Consumo manual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Cambiar encabezado dinámicamente según unidad
                const header =
                  r.unidad === "bulto"
                    ? "Consumo manual (bultos)"
                    : r.unidad === "unidad"
                    ? "Consumo manual (unidades)"
                    : "Consumo manual (litros)";

                return (
                  <tr key={r.material_id} className="border-b">
                    <td className="p-2">{r.nombre}</td>
                    <td className="p-2">{formatUnidad(r.stock, r.unidad)}</td>
                    <td className="p-2">
                      {r.consumo_diario != null
                        ? formatUnidad(r.consumo_diario, r.unidad)
                        : "—"}
                    </td>
                    <td className="p-2">
                      {r.cobertura != null ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.cobertura < 2
                              ? "bg-red-100 text-red-700"
                              : r.cobertura < 4
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {fmtNum(r.cobertura)} días
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">{r.hasta ?? "—"}</td>

                    {/* 👉 Consumo manual */}
                    <td className="p-2">
                      <div className="flex flex-col gap-1 items-center justify-center">
                        <span className="text-xs text-gray-500">{header}</span>
                        <div className="flex gap-2 items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            placeholder={r.unidad}
                            className="w-24 rounded border px-2 py-1 text-sm"
                            id={`manual-${r.material_id}`}
                          />
                          <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                            onClick={async () => {
                              const input = document.getElementById(
                                `manual-${r.material_id}`
                              ) as HTMLInputElement;
                              const value = Number(input.value);
                              if (!value) return;

                              // Guardar consumo manual SIEMPRE en kg
                              let kgValue = value;
                              const mat: Material | undefined = mats.find(
                                (mm) => mm.id === r.material_id
                              );
                              if (
                                mat?.unidad_medida === "bulto" &&
                                mat.presentacion_kg_por_bulto
                              ) {
                                kgValue = value * mat.presentacion_kg_por_bulto;
                              }

                              await supabase.from("consumo_manual").upsert({
                                zona_id: zonaId,
                                material_id: r.material_id,
                                fecha,
                                kg: kgValue,
                              });

                              input.value = "";
                              cargar();
                            }}
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={6}>
                    No hay datos para esa fecha/zona.
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
