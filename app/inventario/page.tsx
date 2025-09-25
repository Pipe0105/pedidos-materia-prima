// app/inventario/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";
import { show2 } from "@/lib/math";
import { useCallback } from "react";


type Material = {
  id: string;
  nombre: string;
  presentacion_kg_por_bulto: number;
  tasa_consumo_diaria_kg: number | null;
};

type Movimiento = {
  material_id: string;
  bultos: number;
  kg: number;
  tipo: "entrada" | "salida" | "ajuste";
};

export default function InventarioPage() {
  const [zonaId, setZonaId] = useState("");
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargar(zid: string) {
    if (!zid) return;
    setLoading(true);

    // 1) Materiales de la zona
    const { data: mats } = await supabase
      .from("materiales")
      .select("id,nombre,presentacion_kg_por_bulto,tasa_consumo_diaria_kg")
      .eq("zona_id", zid)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();
    setMateriales(mats ?? []);

    // 2) Movimientos de inventario en esa zona
    const { data: movs } = await supabase
      .from("movimientos_inventario")
      .select("material_id,bultos,kg,tipo")
      .eq("zona_id", zid)
      .returns<Movimiento[]>();
    setMovs(movs ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (zonaId) void cargar(zonaId);
  }, [zonaId]);

  // Cálculo del stock
  const stock = useMemo(() => {
    const result: Record<string, { b: number; kg: number }> = {};
    for (const m of movs) {
      if (!result[m.material_id]) result[m.material_id] = { b: 0, kg: 0 };
      const mult = m.tipo === "entrada" ? 1 : m.tipo === "salida" ? -1 : 1;
      result[m.material_id].b += m.bultos * mult;
      result[m.material_id].kg += m.kg * mult;
    }
    return result;
  }, [movs]);


  const aplicarConsumo = useCallback(async () => {
  if (!zonaId) return;
  const params = new URLSearchParams({ zonaId });
  const res = await fetch(`/api/consumo/apply?${params.toString()}`, { method: "POST" });
  const j = await res.json();
  // Opcional: mostrar un alert rápido
  if (!res.ok) {
    alert(j.error ?? "Error aplicando consumo");
  } else {
    alert(`Consumo aplicado (${j.inserted} movimientos).`);
    await cargar(zonaId); // refresca tabla
  }
}, [zonaId]);


  // Determinar estado del semáforo
  function estadoMaterial(mat: Material): { dias: number; estado: "verde" | "amarillo" | "rojo" } {
    const st = stock[mat.id] ?? { b: 0, kg: 0 };
    const consumo = mat.tasa_consumo_diaria_kg ?? 0;
    if (consumo <= 0) return { dias: Infinity, estado: "verde" }; // sin consumo registrado

    const dias = st.kg / consumo;
    if (dias > 5) return { dias, estado: "verde" };
    if (dias >= 2) return { dias, estado: "amarillo" };
    return { dias, estado: "rojo" };
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Zona:</span>
          <ZoneSelector value={zonaId} onChange={setZonaId} />
          <button onClick={() => cargar(zonaId)} className="rounded-lg border px-3 py-1 text-sm">
            Refrescar
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-gray-500">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-2">Material</th>
                <th className="p-2">Stock (bultos)</th>
                <th className="p-2">Stock (kg)</th>
                <th className="p-2">Consumo diario (kg)</th>
                <th className="p-2">Cobertura (días)</th>
                <th className="p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => {
                const st = stock[m.id] ?? { b: 0, kg: 0 };
                const { dias, estado } = estadoMaterial(m);
                return (
                  <tr key={m.id} className="border-b">
                    <td className="p-2">{m.nombre}</td>
                    <td className="p-2">{show2(st.b)}</td>
                    <td className="p-2">{show2(st.kg)}</td>
                    <td className="p-2">
                      {m.tasa_consumo_diaria_kg != null ? show2(m.tasa_consumo_diaria_kg) : "—"}
                    </td>
                    <td className="p-2">
                      {dias === Infinity ? "—" : show2(dias)}
                    </td>
                    <td className="p-2">
                      {estado === "verde" && <span className="text-emerald-600">● Verde</span>}
                      {estado === "amarillo" && <span className="text-amber-600">● Amarillo</span>}
                      {estado === "rojo" && <span className="text-rose-600">● Rojo</span>}
                    </td>
                  </tr>
                );
              })}
              {!materiales.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-gray-500">
                    No hay materiales en esta zona.
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
