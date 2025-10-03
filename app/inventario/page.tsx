"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmtNum } from "@/lib/format";

type Zona = {
  id: string;
  nombre: string;
};

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number | null;
  tasa_consumo_diaria_kg: number | null;
  unidad_medida: "bulto" | "unidad" | "litro";
};

type StockRow = {
  material_id: string;
  nombre: string;
  stock: number; // en unidad original
  stockKg: number; // en kg
  unidad: "bulto" | "unidad" | "litro";
  hasta: string | null; // fecha estimada de agotamiento
  cobertura: number | null; // en días
};



// 👉 Singular/plural
function formatUnidad(valor: number, unidad: "bulto" | "unidad" | "litro") {
  const plural =
    unidad === "bulto" ? "bultos" : unidad === "unidad" ? "unidades" : "litros";
  const singular = unidad;
  return `${fmtNum(valor)} ${valor === 1 ? singular : plural}`;
}

// 👉 Fecha de agotamiento saltando domingos
function calcularFechaHasta(fechaBase: string, stockKg: number, consumoDiarioKg: number | null) {
  if (!consumoDiarioKg || consumoDiarioKg <= 0) return null;

  let dias = Math.floor(stockKg / consumoDiarioKg);
  let fecha = new Date(fechaBase);

  while (dias > 0) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0) {
      dias--;
    }
  }

  return fecha.toISOString().slice(0, 10);
}
export default function InventarioPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);  // 👈 este faltaba
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    if (!zonaId) return;
    setLoading(true);

    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg,unidad_medida")
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();

    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("material_id,kg,tipo")
      .eq("zona_id", zonaId);

    const stockKg: Record<string, number> = {};
    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      stockKg[mv.material_id] =
        (stockKg[mv.material_id] ?? 0) + Number(mv.kg) * mult;
    });

    const data: StockRow[] =
      mats?.map((m) => {
        const stKg = stockKg[m.id] ?? 0;

        // stock en unidad original
        let stock = stKg;
        if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
          stock = stKg / m.presentacion_kg_por_bulto;
        }

        // consumo diario en kg
        let consumoKg: number | null = null;
        if (m.unidad_medida === "bulto" && m.presentacion_kg_por_bulto) {
          consumoKg = m.tasa_consumo_diaria_kg
            ? m.tasa_consumo_diaria_kg * m.presentacion_kg_por_bulto
            : null;
        } else {
          consumoKg = m.tasa_consumo_diaria_kg ?? null;
        }

        // cobertura y fecha hasta
        let cobertura: number | null = null;
        if (consumoKg && consumoKg > 0) {
          cobertura = Math.floor(stKg / consumoKg);
        }
        const hasta = calcularFechaHasta(fecha, stKg, consumoKg);

        return {
          material_id: m.id,
          nombre: m.nombre,
          stock,
          stockKg: stKg,
          unidad: m.unidad_medida,
          hasta,
          cobertura,
        };
      }) ?? [];

    setRows(data);
    setLoading(false);
  }

useEffect(() => {
  async function cargarZonas() {
    const { data, error } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");

    if (!error && data) {
      setZonas(data);
      if (data.length > 0 && !zonaId) {
        setZonaId(data[0].id); // 👈 selecciona la primera zona por defecto
      }
    }
  }
  void cargarZonas();
}, []);


return (
  <main className="mx-auto max-w-7xl p-6 space-y-6">
<header>
  <h1 className="text-2xl font-semibold mb-4">Inventario</h1>

  {/* Tabs de zonas */}
  <div className="flex gap-2 bg-gray-100 rounded-full p-1 w-fit mb-4">
    {zonas.map((z) => (
      <button
        key={z.id}
        onClick={() => setZonaId(z.id)}
        className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
          zonaId === z.id
            ? "bg-blue-600 text-white"
            : "text-gray-700 hover:bg-gray-200"
        }`}
      >
        {z.nombre}
      </button>
    ))}
  </div>

  {/* Fecha + refrescar */}
  <div className="flex items-center gap-3">
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
                <th className="p-2">Stock (unidad)</th>
                <th className="p-2">Stock (kg)</th>
                <th className="p-2">Hasta</th>
                <th className="p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.material_id} className="border-b">
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2">{formatUnidad(r.stock, r.unidad)}</td>
                  <td className="p-2">{fmtNum(r.stockKg)} kg</td>
                  <td className="p-2">
                    {r.hasta ? new Date(r.hasta).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="p-2">
                    {r.cobertura != null ? (
                      r.cobertura >= 10 ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          Óptimo
                        </span>
                      ) : r.cobertura <= 3 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          Crítico
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                          Atención
                        </span>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={5}>
                    No hay datos para esta zona.
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
