"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ZoneSelector from "@/components/ZonaSelector";

type Material = {
  id: string;
  nombre: string;
  unidad_medida: "bulto" | "unidad" | "litro";
  presentacion_kg_por_bulto: number | null;
};

export default function ConsumoManualPage() {
  const [zonaId, setZonaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [mats, setMats] = useState<Material[]>([]);

  async function cargar() {
    if (!zonaId) return;
    const { data } = await supabase
      .from("materiales")
      .select("id,nombre,unidad_medida,presentacion_kg_por_bulto")
      .eq("zona_id", zonaId)
      .eq("activo", true)
      .order("nombre")
      .returns<Material[]>();

    setMats(data ?? []);
  }

  useEffect(() => {
    if (zonaId) void cargar();
  }, [zonaId]);

  async function guardarConsumo(mat: Material, valor: number) {
    if (!valor || valor <= 0) return;

    let kgValue = valor;
    if (mat.unidad_medida === "bulto" && mat.presentacion_kg_por_bulto) {
      kgValue = valor * mat.presentacion_kg_por_bulto;
    }

    await supabase.from("consumo_manual").upsert({
      zona_id: zonaId,
      material_id: mat.id,
      fecha,
      kg: kgValue,
    });

    alert(`Consumo manual guardado para ${mat.nombre}`);
    await cargar();
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Registrar Consumo Manual</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Zona:</span>
          <ZoneSelector value={zonaId} onChange={setZonaId} />
          <input
            type="date"
            className="rounded-lg border px-2 py-1 text-sm"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2">Material</th>
              <th className="p-2">Registrar consumo</th>
            </tr>
          </thead>
          <tbody>
            {mats.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.nombre}</td>
                <td className="p-2">
                  <div className="flex gap-2 justify-center">
                    <input
                      type="number"
                      min="0"
                      placeholder={m.unidad_medida}
                      className="w-24 rounded border px-2 py-1 text-sm"
                      id={`manual-${m.id}`}
                    />
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                      onClick={() => {
                        const input = document.getElementById(
                          `manual-${m.id}`
                        ) as HTMLInputElement;
                        const value = Number(input.value);
                        guardarConsumo(m, value);
                        input.value = "";
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!mats.length && (
              <tr>
                <td colSpan={2} className="p-4 text-gray-500">
                  No hay materiales en esta zona.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
