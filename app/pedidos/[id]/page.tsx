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
  kg: number;
  materiales: { nombre: string; presentacion_kg_por_bulto: number } | null;
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

  // cargar pedido + items
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
           materiales ( nombre, presentacion_kg_por_bulto )`
        )
        .eq("pedido_id", pedidoId);

      if (pedido) {
        // 🔹 Autocompletar si la fecha de entrega ya pasó
        if (
          pedido.fecha_entrega &&
          new Date(pedido.fecha_entrega) <= new Date() &&
          pedido.estado !== "completado"
        ) {
          await supabase
            .from("pedidos")
            .update({ estado: "completado" })
            .eq("id", pedido.id);

          setPedido({ ...pedido, estado: "completado" });
        } else {
          setPedido(pedido);
        }
      }

      // 👇 normalizar materiales (si viene array, tomar el primer objeto)
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

    if (pedidoId) {
      void fetchData();
    }
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
        total_kg: items.reduce((sum, it) => sum + it.kg, 0),
      })
      .eq("id", pedido.id);

    setSaving(false);

    if (error) notify("Error al guardar: " + error.message, "error");
    else {
      notify("Pedido actualizado ✅", "success");
      router.push("/"); // 🔹 Ir al home
    }
  }

  async function marcarCompletado() {
    if (!pedido) return;
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "completado" })
      .eq("id", pedido.id);

    if (error) {
      notify("Error al completar pedido: " + error.message, "error");
    } else {
      setPedido({ ...pedido, estado: "completado" });
      notify("Pedido completado ✅", "success");
    }
  }

  async function agregarMaterial(
    id: string,
    meta?: { nombre: string; presentacion_kg_por_bulto: number }
  ) {
    if (!meta) return;
    const nuevo = {
      pedido_id: pedidoId,
      material_id: id,
      bultos: 1,
      kg: meta.presentacion_kg_por_bulto,
    };

    const { data } = await supabase
      .from("pedido_items")
      .insert(nuevo)
      .select(
        `id, material_id, bultos, kg,
         materiales ( nombre, presentacion_kg_por_bulto )`
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

  async function actualizarItem(id: string, bultos: number, kg: number) {
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
        <div>
          <h1 className="text-2xl font-bold">Editar pedido</h1>
          <p className="text-gray-500 text-sm">
            Planta:{" "}
            <span className="font-semibold">{pedido.zonas?.[0]?.nombre}</span>
          </p>
        </div>
        <div>
          {pedido.estado && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100">
              {pedido.estado}
            </span>
          )}
        </div>
      </header>

      {/* Datos */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div>
          <label className="text-sm font-medium">Solicitante</label>
          <input
            type="text"
            value={pedido.solicitante ?? ""}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, solicitante: e.target.value })
            }
            className="w-full rounded-lg border px-3 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Fecha de entrega</label>
          <input
            type="date"
            value={pedido.fecha_entrega ?? ""}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, fecha_entrega: e.target.value })
            }
            className="w-full rounded-lg border px-3 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Notas</label>
          <textarea
            value={pedido.notas ?? ""}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, notas: e.target.value })
            }
            className="w-full rounded-lg border px-3 py-1 text-sm"
          />
        </div>
      </div>

      {/* Materiales */}
      <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Materiales</h2>
        <MaterialPicker zonaId={pedido.zona_id} onChange={agregarMaterial} />
        {items.length > 0 ? (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left align-middle">Material</th>
                <th className="p-2 align-middle">Bultos</th>
                <th className="p-2 align-middle">Kg</th>
                <th className="p-2 align-middle">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="p-2 align-middle">
                    {it.materiales?.nombre || "—"}
                  </td>
                  <td className="p-2 align-middle" align="center">
                    <input
                      type="number"
                      value={it.bultos}
                      min={1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const newKg =
                          val * (it.materiales?.presentacion_kg_por_bulto || 1);
                        actualizarItem(it.id, val, newKg);
                      }}
                      className="w-20 border rounded px-2 py-1 text-sm text-center"
                    />
                  </td>
                  <td className="p-2 align-middle" align="center">{it.kg}</td>
                  <td className="p-2 align-middle" align="center">
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

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={guardarCambios}
          disabled={saving}
          className="flex items-center gap-1 rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "💾 Guardando..." : "💾 Guardar cambios"}
        </button>

        {(pedido.estado === "enviado" || pedido.estado === "recibido") && (
          <button
            onClick={marcarCompletado}
            className="flex items-center gap-1 rounded bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700"
          >
            ✅ Completar pedido
          </button>
        )}

        <button
          onClick={() => router.push("/pedidos")}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </main>
  );
}
