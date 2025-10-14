"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";
import ZoneSelector from "@/components/ZonaSelector";
import PedidosZona from "../../pedidoszonas";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  notas?: string | null;
  zona_id: string;
  zonas?: { nombre: string } | {nombre: string}[] | null;
};

type PedidoItem = {
  id: string;
  material_id: string;
  bultos: number;
  kg: number | null;
  materiales: {
    nombre: string;
    presentacion_kg_por_bulto: number | null;
    unidad_medida: "bulto" | "unidad" | "litro";
  } | null;
};

export default function PedidoEditor() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const pedidoId = id;
  const { notify } = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: pedido } = await supabase
        .from("pedidos")
        .select(
          `id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, notas, zona_id,
           zonas ( nombre )`
        )
        .eq("id", pedidoId)
        .single();

      const { data: items } = await supabase
        .from("pedido_items")
        .select(
          `id, material_id, bultos, kg,
           materiales ( nombre, presentacion_kg_por_bulto, unidad_medida )`
        )
        .eq("pedido_id", pedidoId);

      if (pedido) setPedido(pedido);

      setItems(
        (items || []).map((it: any) => ({
          ...it,
          materiales: Array.isArray(it.materiales)
            ? it.materiales[0]
            : it.materiales,
        }))
      );

      setLoading(false);
    };

    if (pedidoId) void fetchData();
  }, [pedidoId]);

  async function guardarCambios() {
    if (!pedido) return;
    setSaving(true);

    const { error } = await supabase
      .from("pedidos")
      .update({
        solicitante: pedido.solicitante,
        fecha_entrega: pedido.fecha_entrega,
        notas: pedido.notas,
        estado: pedido.estado,
        total_bultos: items.reduce((sum, it) => sum + it.bultos, 0),
        total_kg: items.reduce((sum, it) => sum + (it.kg ?? 0), 0),
      })
      .eq("id", pedido.id);

    setSaving(false);

    if (error) notify("Error al guardar: " + error.message, "error");
    else {
      notify("Pedido actualizado ✅", "success");
      router.push("/");
    }
  }
  async function actualizarItem(id: string, bultos: number, kg: number | null) {
    await supabase.from("pedido_items").update({ bultos, kg }).eq("id", id);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, bultos, kg } : it))
    );
  }

  async function eliminarItem(id: string) {
    await supabase.from("pedido_items").delete().eq("id", id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    notify("Material eliminado ✅", "success");
  }

  if (loading) return <div className="p-6">Cargando pedido...</div>;
  if (!pedido)
    return <div className="p-6 text-red-600">Pedido no encontrado.</div>;

  const zonaNombre = Array.isArray(pedido.zonas)
    ? pedido.zonas[0]?.nombre
    : pedido.zonas?.nombre;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedido {zonaNombre ? `  ${zonaNombre}` : "" } </h1>
      </header>

      {/* Materiales */}
      <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Materiales</h2>
        {items.length > 0 ? (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Material</th>
                <th className="p-2">Unidad</th>
                <th className="p-2">Cantidad</th>
                <th className="p-2">Kg</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-2">{it.materiales?.nombre || "—"}</td>
                  <td className="p-2" align="center">{it.materiales?.unidad_medida}</td>
                  <td className="p-2" align="center">{it.bultos}</td>
                  <td className="p-2" align="center">{it.kg ?? "—"}</td>
                  <td className="p-2" align="center">
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">
            No hay materiales en este pedido.
          </p>
        )}
      </div>

    </main>
  );
}
