"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageContainer } from "@/components/PageContainer";

type Zona = {
  id: string;
  nombre: string;
};

type Row = {
  fecha: string;
  material_id: string;
  material_nombre: string;
  unidad_medida: "bulto" | "unidad" | "litro";
  zona_id: string;
  zona_nombre: string;
  stock_real: number;
  stock_teorico: number;
  consumo_auto: number;
  diferencia: number;
};

export default function ControlPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);

    // 1️⃣ Zonas activas
    const { data: zonasData } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");

    if (zonasData && zonasData.length > 0) {
      setZonas(zonasData);
      if (!zonaActiva) setZonaActiva(zonasData[0].id); // activa la primera zona
    }

    // 2️⃣ Stock real (usa la misma función que /inventario)
    const { data: stockData } = await supabase.rpc("get_stock_actual");

    // 3️⃣ Consumo automático
    const { data: autoData } = await supabase
      .from("consumo_auto")
      .select(
        "fecha, zona_id, material_id, bultos, materiales(nombre, unidad_medida, presentacion_kg_por_bulto), zonas(nombre)"
      )
      .order("fecha", { ascending: false });

    const map = new Map<string, Row>();

    (autoData || []).forEach((a: any) => {
      const key = `${a.zona_id}-${a.material_id}`;
      const stockRow = stockData?.find(
        (s: any) => s.zona_id === a.zona_id && s.material_id === a.material_id
      );

      const unidad = a.materiales?.unidad_medida || "bulto";

      // ✅ Stock real tomado del RPC exacto (coincide con /inventario)
      const stock_real =
        unidad === "bulto"
          ? Number(stockRow?.stock_bultos || 0)
          : unidad === "unidad"
          ? Number(stockRow?.stock_bultos || 0)
          : Number(stockRow?.stock_kg || 0);

      // ✅ Consumo automático
      const consumo_auto = Number(a.bultos) || 0;

      // ✅ Stock teórico esperado (resta el consumo del stock real)
      const stock_teorico = stock_real - consumo_auto;

      // ✅ Diferencia (positiva o negativa)
      const diferencia = stock_real - stock_teorico;

      map.set(key, {
        fecha: a.fecha,
        zona_id: a.zona_id,
        zona_nombre: a.zonas?.nombre || "",
        material_id: a.material_id,
        material_nombre: a.materiales?.nombre || "",
        unidad_medida: unidad,
        stock_real,
        stock_teorico,
        consumo_auto,
        diferencia,
      });
    });

    setRows(Array.from(map.values()));
    setLoading(false);
  }

  function formatDiff(valor: number, unidad: string) {
    const signo = valor > 0 ? "+" : "";
    return `${signo}${fmtNum(Math.abs(valor))} ${unidad}${
      Math.abs(valor) !== 1 ? "s" : ""
    }`;
  }

  function estadoColor(diff: number) {
    if (diff >= 0) return "text-green-600";
    if (diff < 0 && diff > -5) return "text-yellow-600";
    return "text-red-600";
  }

  return (
    <PageContainer className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Control de Consumo</h1>
      </header>

      <Tabs value={zonaActiva ?? ""} onValueChange={setZonaActiva}>
        <TabsList>
          {zonas.map((z) => (
            <TabsTrigger key={z.id} value={z.id}>
              {z.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        {zonas.map((z) => (
          <TabsContent key={z.id} value={z.id}>
            {zonaActiva === z.id && (
              <div className="overflow-x-auto mt-4 border rounded-lg bg-white shadow-sm">
                <table className="min-w-full text-sm text-center">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-4 py-2">Fecha</th>
                      <th className="px-4 py-2">Material</th>
                      <th className="px-4 py-2">Stock real</th>
                      <th className="px-4 py-2">Consumo automático</th>
                      <th className="px-4 py-2">Stock teórico (Auto)</th>
                      <th className="px-4 py-2">Diferencia</th>
                      <th className="px-4 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : (
                      rows
                        .filter((r) => r.zona_id === z.id)
                        .map((r) => (
                          <tr key={r.material_id} className="border-t">
                            <td className="px-4 py-2">{r.fecha}</td>
                            <td className="px-4 py-2">{r.material_nombre}</td>

                            <td className="px-4 py-2 text-gray-700">
                              {fmtNum(r.stock_real)} {r.unidad_medida}
                              {r.stock_real !== 1 ? "s" : ""}
                            </td>

                            <td className="px-4 py-2 text-blue-600">
                              {fmtNum(r.consumo_auto)} {r.unidad_medida}
                              {r.consumo_auto !== 1 ? "s" : ""}
                            </td>

                            <td className="px-4 py-2 text-gray-700">
                              {fmtNum(r.stock_teorico)} {r.unidad_medida}
                              {r.stock_teorico !== 1 ? "s" : ""}
                            </td>

                            <td
                              className={`px-4 py-2 font-semibold ${estadoColor(
                                r.diferencia
                              )}`}
                            >
                              {formatDiff(r.diferencia, r.unidad_medida)}
                            </td>

                            <td className="px-4 py-2">
                              {r.diferencia >= 0
                                ? "🟢"
                                : r.diferencia > -5
                                ? "🟡"
                                : "🔴"}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
