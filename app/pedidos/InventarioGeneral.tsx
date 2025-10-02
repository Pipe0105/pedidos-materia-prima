"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { useToast } from "@/components/toastprovider";

type Movimiento = {
  material_id: string;
  tipo: "entrada" | "salida" | "ajuste";
  kg: number | null;
  bultos: number | null;
  materiales: { nombre: string }[]; // 👈 Supabase devuelve array
};

type MaterialInventario = {
  id: string;
  nombre: string;
  stock_kg: number;
  stock_bultos: number;
};

export default function InventarioGeneral() {
  const { notify } = useToast();
  const [inventario, setInventario] = useState<MaterialInventario[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargarInventario() {
    setLoading(true);

    const { data, error } = await supabase
      .from("movimientos_inventario")
      .select("material_id, tipo, kg, bultos, materiales(nombre)") as {
        data: Movimiento[] | null;
        error: any;
      };

    if (error) {
      notify("Error cargando inventario: " + error.message, "error");
      setLoading(false);
      return;
    }

    const mapa: Record<string, MaterialInventario> = {};

    (data || []).forEach((mov) => {
      const id = mov.material_id;
      const nombreMaterial = mov.materiales?.[0]?.nombre || "—";

      if (!mapa[id]) {
        mapa[id] = {
          id,
          nombre: nombreMaterial,
          stock_kg: 0,
          stock_bultos: 0,
        };
      }

      let mult = 0;
      if (mov.tipo === "entrada") mult = 1;
      if (mov.tipo === "salida") mult = -1;
      if (mov.tipo === "ajuste") mult = 1;

      mapa[id].stock_kg += (mov.kg || 0) * mult;
      mapa[id].stock_bultos += (mov.bultos || 0) * mult;
    });

    setInventario(Object.values(mapa));
    setLoading(false);
  }

  useEffect(() => {
    void cargarInventario();
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventario General</h1>
        <button
          onClick={cargarInventario}
          className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
        >
          Recargar
        </button>
      </header>

      {loading ? (
        <p className="text-gray-500">Cargando inventario…</p>
      ) : inventario.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm text-center">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2">Material</th>
                <th className="p-2">Stock (Kg)</th>
                <th className="p-2">Stock (Bultos)</th>
              </tr>
            </thead>
            <tbody>
              {inventario.map((m) => (
                <tr key={m.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{m.nombre}</td>
                  <td className="p-2">{fmtNum(m.stock_kg)}</td>
                  <td className="p-2">{fmtNum(m.stock_bultos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No hay movimientos de inventario.</p>
      )}
    </main>
  );
}
