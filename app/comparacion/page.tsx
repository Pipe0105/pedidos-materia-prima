"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { fmtNum } from "@/lib/format";

type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number;
  tasa_consumo_diaria_kg: number | null;
};

type ConsumoRow = {
  material_id: string;
  nombre: string;
  stock_kg: number;
  consumo_kg: number | null;
  cobertura: number | null;
  hasta: string | null;
};

type DiffRow = {
  material_id: string;
  nombre: string;
  consumo_auto: number | null;
  consumo_manual: number | null;
  diferencia: number | null;
};

export default function ComparacionPage() {
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [rowsAuto, setRowsAuto] = useState<ConsumoRow[]>([]);
  const [rowsManual, setRowsManual] = useState<ConsumoRow[]>([]);
  const [rowsDiff, setRowsDiff] = useState<DiffRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    if (!zonaId || !fecha) return;
    setLoading(true);

    // Materiales
    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg")
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();

    // Consumo auto
    const { data: auto } = await supabase
      .from("consumo_auto")
      .select("material_id,kg")
      .eq("zona_id", zonaId)
      .eq("fecha", fecha);

    // Consumo manual
    const { data: manual } = await supabase
      .from("consumo_manual")
      .select("material_id,kg")
      .eq("zona_id", zonaId)
      .eq("fecha", fecha);

    // Movimientos inventario
    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("material_id,kg,tipo")
      .eq("zona_id", zonaId);

    const stock: Record<string, number> = {};
    (movs ?? []).forEach((mv) => {
      const mult = mv.tipo === "entrada" ? 1 : mv.tipo === "salida" ? -1 : 1;
      stock[mv.material_id] =
        (stock[mv.material_id] ?? 0) + Number(mv.kg) * mult;
    });

    // Mapas
    const autoMap = new Map<string, number>();
    (auto ?? []).forEach((a) => autoMap.set(a.material_id, Number(a.kg)));

    const manualMap = new Map<string, number>();
    (manual ?? []).forEach((m) => manualMap.set(m.material_id, Number(m.kg)));

    // Filas automáticas
    const autoRows: ConsumoRow[] =
      mats?.map((m) => {
        const st = stock[m.id] ?? 0;
        const consumo = autoMap.get(m.id) ?? m.tasa_consumo_diaria_kg ?? null;

        let cobertura: number | null = null;
        let hasta: string | null = null;
        if (consumo && consumo > 0) {
          cobertura = st / consumo;
          const base = new Date(fecha);
          base.setDate(base.getDate() + Math.floor(cobertura));
          hasta = base.toISOString().slice(0, 10);
        }

        return {
          material_id: m.id,
          nombre: m.nombre,
          stock_kg: st,
          consumo_kg: consumo,
          cobertura,
          hasta,
        };
      }) ?? [];

    // Filas manuales
    const manualRows: ConsumoRow[] =
      mats?.map((m) => {
        const st = stock[m.id] ?? 0;
        const consumo = manualMap.get(m.id) ?? null;

        let cobertura: number | null = null;
        let hasta: string | null = null;
        if (consumo && consumo > 0) {
          cobertura = st / consumo;
          const base = new Date(fecha);
          base.setDate(base.getDate() + Math.floor(cobertura));
          hasta = base.toISOString().slice(0, 10);
        }

        return {
          material_id: m.id,
          nombre: m.nombre,
          stock_kg: st,
          consumo_kg: consumo,
          cobertura,
          hasta,
        };
      }) ?? [];

    // Tabla de diferencias
    const diffRows: DiffRow[] =
      mats?.map((m) => {
        const consumoAuto = autoMap.get(m.id) ?? null;
        const consumoManual = manualMap.get(m.id) ?? null;
        const diferencia =
          consumoAuto != null && consumoManual != null
            ? consumoManual - consumoAuto
            : null;

        return {
          material_id: m.id,
          nombre: m.nombre,
          consumo_auto: consumoAuto,
          consumo_manual: consumoManual,
          diferencia,
        };
      }) ?? [];

    setRowsAuto(autoRows);
    setRowsManual(manualRows);
    setRowsDiff(diffRows);
    setLoading(false);
  }

  useEffect(() => {
    if (zonaId) void cargar();
  }, [zonaId, fecha]);

  function renderConsumoTable(title: string, rows: ConsumoRow[]) {
    return (
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-gray-700 p-3">{title}</h2>
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2">Material</th>
              <th className="p-2">Stock (kg)</th>
              <th className="p-2">Consumo (kg)</th>
              <th className="p-2">Cobertura (días)</th>
              <th className="p-2">Hasta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.material_id} className="border-b">
                <td className="p-2">{r.nombre ?? "—"}</td>
                <td className="p-2">{fmtNum(r.stock_kg)}</td>
                <td className="p-2">
                  {r.consumo_kg != null ? fmtNum(r.consumo_kg) : "—"}
                </td>
                <td className="p-2">
                  {r.cobertura != null && r.cobertura >= 0
                    ? fmtNum(r.cobertura)
                    : "—"}
                </td>
                <td className="p-2">
                  {r.hasta && r.cobertura && r.cobertura > 0 ? r.hasta : "—"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={5}>
                  No hay datos para esa fecha/zona.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderDiffTable(rows: DiffRow[]) {
    return (
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-gray-700 p-3">
          Diferencia Manual - Automático
        </h2>
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2">Material</th>
              <th className="p-2">Consumo Auto (kg)</th>
              <th className="p-2">Consumo Manual (kg)</th>
              <th className="p-2">Diferencia (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.material_id} className="border-b">
                <td className="p-2">{r.nombre ?? "—"}</td>
                <td className="p-2">
                  {r.consumo_auto != null ? fmtNum(r.consumo_auto) : "—"}
                </td>
                <td className="p-2">
                  {r.consumo_manual != null ? fmtNum(r.consumo_manual) : "—"}
                </td>
                <td
                  className={`p-2 font-medium ${
                    r.diferencia != null
                      ? r.diferencia > 0
                        ? "text-red-600"
                        : r.diferencia < 0
                        ? "text-green-600"
                        : "text-gray-600"
                      : "text-gray-400"
                  }`}
                >
                  {r.diferencia != null ? fmtNum(r.diferencia) : "—"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={4}>
                  No hay datos para esa fecha/zona.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
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
            className="rounded-lg border px-3 py-1 text-sm"
          >
            Refrescar
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-gray-500">Cargando…</div>
      ) : (
        <div className="space-y-6">
          {renderConsumoTable("Consumo Automático", rowsAuto)}
          {renderConsumoTable("Consumo Manual", rowsManual)}
          {renderDiffTable(rowsDiff)}
        </div>
      )}
    </main>
  );
}
