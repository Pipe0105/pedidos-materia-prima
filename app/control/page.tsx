"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Zona = {
  id: string;
  nombre: string;
};

type Row = {
  id: string;
  fecha: string;
  material_id: string;
  material_nombre: string;
  zona_id: string;
  zona_nombre: string;
  unidad_medida: "bulto" | "unidad" | "litro";
  presentacion_kg_por_bulto: number | null;
  auto_kg: number | null;
  auto_bultos: number | null;
  manual_kg: number | null;
  manual_bultos: number | null;
  stock_kg: number | null;
  stock_bultos: number | null;
};

export default function ControlPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // Modal
  const [open, setOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [valor, setValor] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);

    const { data: zonasData } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");

    setZonas(zonasData || []);

    const { data: stockData } = await supabase.rpc("get_stock_actual");

    const { data: auto } = await supabase
      .from("consumo_auto")
      .select(
        "id, fecha, kg, bultos, zona_id, material_id, materiales(nombre, unidad_medida, presentacion_kg_por_bulto), zonas(nombre)"
      )
      .order("fecha", { ascending: false });

    const { data: manual } = await supabase
      .from("consumo_manual")
      .select("id, fecha, kg, bultos, zona_id, material_id");

    const map = new Map<string, Row>();

    (auto || []).forEach((r: any) => {
      const key = `${r.fecha}-${r.zona_id}-${r.material_id}`;
      const stockRow = stockData?.find(
        (s: any) => s.material_id === r.material_id && s.zona_id === r.zona_id
      );
      map.set(key, {
        id: r.id,
        fecha: r.fecha,
        zona_id: r.zona_id,
        zona_nombre: r.zonas?.nombre || "",
        material_id: r.material_id,
        material_nombre: r.materiales?.nombre || "",
        unidad_medida: r.materiales?.unidad_medida || "bulto",
        presentacion_kg_por_bulto: r.materiales?.presentacion_kg_por_bulto || 0,
        auto_kg: Number(r.kg) || 0,
        auto_bultos: Number(r.bultos) || 0,
        manual_kg: null,
        manual_bultos: null,
        stock_kg: stockRow?.stock_kg || 0,
        stock_bultos: stockRow?.stock_bultos || 0,
      });
    });

    (manual || []).forEach((r: any) => {
      const key = `${r.fecha}-${r.zona_id}-${r.material_id}`;
      if (map.has(key)) {
        map.get(key)!.manual_kg = Number(r.kg) || 0;
        map.get(key)!.manual_bultos = Number(r.bultos) || 0;
      }
    });

    setRows(Array.from(map.values()));
    setLoading(false);
  }

  async function aplicarConsumoHoy() {
    setApplying(true);
    const { error } = await supabase.rpc("aplicar_consumo_diario");
    if (error) console.error("Error al aplicar consumo diario:", error);
    await cargarDatos();
    setApplying(false);
  }

  async function guardarManual() {
    if (!selectedRow) return;
    const num = parseFloat(valor);
    if (isNaN(num)) return;

    const kgCalc = num * (selectedRow.presentacion_kg_por_bulto || 0);
    const bultosCalc = num;

    const { error } = await supabase
      .from("consumo_manual")
      .upsert(
        {
          zona_id: selectedRow.zona_id,
          material_id: selectedRow.material_id,
          fecha: selectedRow.fecha,
          kg: kgCalc,
          bultos: bultosCalc,
        },
        { onConflict: "zona_id,material_id,fecha" }
      );

    if (error) console.error(error);
    setOpen(false);
    setValor("");
    await cargarDatos();
  }

  async function eliminarManual(r: Row) {
    if (!confirm(`¿Eliminar el consumo manual de ${r.material_nombre}?`)) return;

    const { error } = await supabase
      .from("consumo_manual")
      .delete()
      .eq("material_id", r.material_id)
      .eq("fecha", r.fecha)
      .eq("zona_id", r.zona_id);

    if (error) console.error(error);
    await cargarDatos();
  }

  function formatConsumo(bultos: number | null, kg: number | null, unidad: string) {
    if (bultos !== null && bultos > 0) {
      return `${fmtNum(bultos)} ${unidad}${bultos !== 1 ? "s" : ""} / ${fmtNum(kg || 0)} kg`;
    }
    return `${fmtNum(kg || 0)} kg`;
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Control de Consumo</h1>
        <div className="flex gap-2">
          <Button onClick={aplicarConsumoHoy} disabled={applying}>
            {applying ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Aplicar consumo automático
          </Button>
        </div>
      </header>

      <Tabs defaultValue={zonas[0]?.id}>
        <TabsList>
          {zonas.map((z) => (
            <TabsTrigger key={z.id} value={z.id}>
              {z.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        {zonas.map((z) => (
          <TabsContent key={z.id} value={z.id}>
            <div className="overflow-x-auto mt-4 border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                <tr>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Material</th>
                    <th className="px-4 py-2">Stock actual</th>
                    <th className="px-4 py-2">Consumo automático</th>
                    <th className="px-4 py-2">Consumo manual</th>
                    <th className="px-4 py-2">Stock simulado (Auto)</th>
                    <th className="px-4 py-2">Stock real (Manual)</th>
                    <th className="px-4 py-2">Diferencia (Bultos / Kg)</th>
                    <th className="px-4 py-2">Acciones</th>
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
                      .map((r) => {
                        const diffBultos = (r.manual_bultos ?? 0) - (r.auto_bultos ?? 0);
                        const diffKg = (r.manual_kg ?? 0) - (r.auto_kg ?? 0);

                        return (
                          <tr key={r.id} className="border-t">
                            <td className="px-4 py-2">{r.fecha}</td>
                            <td className="px-4 py-2">{r.material_nombre}</td>
                            <td className="px-4 py-2 text-gray-700">
                              {formatConsumo(r.stock_bultos, r.stock_kg, r.unidad_medida)}
                            </td>
                            <td className="px-4 py-2 text-blue-600">
                              {formatConsumo(
                                (r.stock_bultos ?? 0) - (r.auto_bultos ?? 0),
                                (r.stock_kg ?? 0) - (r.auto_kg ?? 0),
                                r.unidad_medida
                              )}
                            </td>
                            <td className="px-4 py-2 text-green-600">
                              {formatConsumo(
                                (r.stock_bultos ?? 0) - (r.manual_bultos ?? 0),
                                (r.stock_kg ?? 0) - (r.manual_kg ?? 0),
                                r.unidad_medida
                              )}
                            </td>
                            <td
                              className={`px-4 py-2 ${
                                r.manual_kg !== null && r.auto_kg !== null
                                  ? diffKg > 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                  : ""
                              }`}
                            >
                              {r.manual_kg !== null && r.auto_kg !== null
                                ? `${fmtNum(diffBultos)} ${r.unidad_medida}${
                                    diffBultos !== 1 ? "s" : ""
                                  } / ${fmtNum(diffKg)} kg`
                                : "—"}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                <button
                                  className="flex items-center text-blue-600 hover:underline"
                                  onClick={() => {
                                    setSelectedRow(r);
                                    setValor(r.manual_bultos?.toString() || "");
                                    setOpen(true);
                                  }}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  {r.manual_kg ? "Editar" : "Registrar"} manual
                                </button>
                                {r.manual_kg && (
                                  <button
                                    className="text-red-600 hover:underline flex items-center"
                                    onClick={() => eliminarManual(r)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRow?.manual_kg
                ? `Editar consumo manual - ${selectedRow?.material_nombre}`
                : `Registrar consumo manual - ${selectedRow?.material_nombre}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="number"
              placeholder={`${
                selectedRow?.unidad_medida
                  ? `${selectedRow.unidad_medida.charAt(0).toUpperCase() +
                      selectedRow.unidad_medida.slice(1)}s`
                  : "Cantidad"
              } consumidos`}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={guardarManual}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
