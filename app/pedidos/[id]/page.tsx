"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";
import MaterialPicker from "@/components/MaterialPicker";

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
  zonas?: { nombre: string }[];
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
      router.push(
        pedido.zona_id
          ? `/pedidos?tab=${encodeURIComponent(pedido.zona_id)}`
          :"/pedidos"
      );
    }
  }

  async function agregarMaterial(
    id: string,
    meta?: {
      nombre: string;
      presentacion_kg_por_bulto: number | null;
      unidad_medida: "bulto" | "unidad" | "litro";
    }
  ) {
    if (!meta) return;
    const nuevo = {
      pedido_id: pedidoId,
      material_id: id,
      bultos: 1,
      kg: meta.unidad_medida === "bulto" ? meta.presentacion_kg_por_bulto : null,
    };

    const { data } = await supabase
      .from("pedido_items")
      .insert(nuevo)
      .select(
        `id, material_id, bultos, kg,
         materiales ( nombre, presentacion_kg_por_bulto, unidad_medida )`
      )
      .single();

    if (data) {
      setItems((prev) => [
        ...prev,
        {
          ...data,
          materiales: Array.isArray(data.materiales)
            ? data.materiales[0]
            : data.materiales,
        },
      ]);
      notify("Material agregado ✅", "success");
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

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar pedido</h1>
      </header>

      {/* Materiales */}
      <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Materiales</h2>
        <MaterialPicker zonaId={pedido.zona_id} onChange={agregarMaterial} />
        {items.length > 0 ? (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Material</th>
                <th className="p-2">Unidad</th>
                <th className="p-2">Cantidad</th>
                <th className="p-2">Kg</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-2">{it.materiales?.nombre || "—"}</td>
                  <td className="p-2" align="center">{it.materiales?.unidad_medida}</td>
                  <td className="p-2" align="center">
                    <input
                      type="number"
                      value={it.bultos}
                      min={1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (it.materiales?.unidad_medida === "bulto") {
                          const newKg =
                            val *
                            (it.materiales?.presentacion_kg_por_bulto || 1);
                          actualizarItem(it.id, val, newKg);
                        } else {
                          actualizarItem(it.id, val, null);
                        }
                      }}
                      className="w-20 border rounded px-2 py-1 text-sm text-center"
                    />
                  </td>
                  <td className="p-2" align="center">{it.kg ?? "—"}</td>
                  <td className="p-2" align="center">
                    <button
                      onClick={() => eliminarItem(it.id)}
                      className="text-rose-600 hover:underline text-sm"
                    >
                      Eliminar
                    </button>
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

      <div className="flex gap-3">
        <button
          onClick={guardarCambios}
          disabled={saving}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          onClick={() =>
            router.push(
              pedido?.zona_id
                ? `/pedidos?tab=${encodeURIComponent(pedido.zona_id)}`
                : "/pedidos"
            )
          }
          className="rounded border px-4 py-2 text-sm hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </main>
  );
}
