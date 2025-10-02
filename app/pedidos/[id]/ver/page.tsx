"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/lib/format";
import MaterialPicker from "@/components/MaterialPicker";

type Pedido = {
  id: string;
  zona_id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "borrador" | "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  notas?: string | null;
};

type ItemRow = {
  id?: string;
  material_id: string;
  material_nombre?: string;
  presentacion?: number;
  bultos: number;
  kg: number;
};

export default function PedidoEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pedidoId = params?.id as string;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  // === Cargar pedido e items ===
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (pedidoId === "nuevo") {
          // Crear pedido vacío en memoria
          setPedido({
            id: "",
            zona_id: "",
            fecha_pedido: new Date().toISOString().slice(0, 10),
            fecha_entrega: null,
            solicitante: "",
            estado: "borrador",
            total_bultos: 0,
            total_kg: 0,
            notas: "",
          });
          setItems([]);
        } else {
          // Pedido existente
          const { data: ped } = await supabase
            .from("pedidos")
            .select(
              "id,zona_id,fecha_pedido,fecha_entrega,solicitante,estado,total_bultos,total_kg,notas"
            )
            .eq("id", pedidoId)
            .single();

          const { data: its } = await supabase
            .from("pedido_items")
            .select(
              "id,material_id,bultos,kg,materiales(nombre,presentacion_kg_por_bulto)"
            )
            .eq("pedido_id", pedidoId);

          setPedido(ped as Pedido);

          const mapped: ItemRow[] =
            (its ?? []).map((r: any) => ({
              id: r.id,
              material_id: r.material_id,
              material_nombre: r.materiales?.nombre ?? "",
              presentacion: r.materiales?.presentacion_kg_por_bulto ?? undefined,
              bultos: r.bultos ?? 0,
              kg: r.kg ?? 0,
            })) ?? [];

          setItems(mapped);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [pedidoId]);

  // === Guardar pedido e items ===
  async function guardarPedido() {
    if (!pedido) return;

    let pedId = pedido.id;

    if (pedidoId === "nuevo") {
      // Insertar nuevo
      const { data, error } = await supabase
        .from("pedidos")
        .insert({
          zona_id: pedido.zona_id,
          fecha_pedido: pedido.fecha_pedido,
          fecha_entrega: pedido.fecha_entrega,
          solicitante: pedido.solicitante,
          estado: "borrador",
          notas: pedido.notas,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creando pedido:", error);
        return;
      }
      pedId = data.id;
    } else {
      // Actualizar
      await supabase
        .from("pedidos")
        .update({
          solicitante: pedido.solicitante,
          fecha_entrega: pedido.fecha_entrega,
          notas: pedido.notas,
        })
        .eq("id", pedId);
    }

    // Guardar items
    for (const it of items) {
      if (it.id) {
        await supabase
          .from("pedido_items")
          .update({
            material_id: it.material_id,
            bultos: it.bultos,
            kg: it.kg,
          })
          .eq("id", it.id);
      } else {
        await supabase.from("pedido_items").insert({
          pedido_id: pedId,
          material_id: it.material_id,
          bultos: it.bultos,
          kg: it.kg,
        });
      }
    }

    router.push("/pedidos");
  }

  // === Añadir item vacío ===
  function addItem() {
    setItems([...items, { material_id: "", bultos: 0, kg: 0 }]);
  }

  // === Eliminar item local ===
  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {pedidoId === "nuevo" ? "Nuevo pedido" : "Editar pedido"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={guardarPedido}
            className="rounded bg-blue-600 text-white px-3 py-1 text-sm"
          >
            Guardar
          </button>
          <button
            onClick={() => router.back()}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Cancelar
          </button>
        </div>
      </header>

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : !pedido ? (
        <p className="text-gray-500">No se encontró el pedido.</p>
      ) : (
        <div className="space-y-4">
          {/* Datos generales */}
          <div className="rounded-lg border bg-white p-4 shadow-sm space-y-2">
            <label className="block text-sm">
              Solicitante:
              <input
                type="text"
                className="mt-1 w-full border rounded px-2 py-1 text-sm"
                value={pedido.solicitante ?? ""}
                onChange={(e) =>
                  setPedido({ ...pedido, solicitante: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              Fecha entrega:
              <input
                type="date"
                className="mt-1 w-full border rounded px-2 py-1 text-sm"
                value={pedido.fecha_entrega ?? ""}
                onChange={(e) =>
                  setPedido({ ...pedido, fecha_entrega: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              Notas:
              <textarea
                className="mt-1 w-full border rounded px-2 py-1 text-sm"
                value={pedido.notas ?? ""}
                onChange={(e) =>
                  setPedido({ ...pedido, notas: e.target.value })
                }
              />
            </label>
          </div>

          {/* Items */}
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="min-w-full text-sm text-center">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2">Material</th>
                  <th className="p-2">Bultos</th>
                  <th className="p-2">Kg</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">
                      <MaterialPicker
                        zonaId={pedido.zona_id}
                        onChange={(materialId) =>
                          setItems(
                            items.map((row, j) =>
                              j === idx ? { ...row, material_id: materialId } : row
                            )
                          )
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="w-20 border rounded px-2 py-1 text-sm"
                        value={i.bultos}
                        onChange={(e) => {
                          const bultos = Number(e.target.value);
                          const kg = (i.presentacion ?? 0) * bultos;
                          setItems(
                            items.map((row, j) =>
                              j === idx ? { ...row, bultos, kg } : row
                            )
                          );
                        }}
                      />
                    </td>
                    <td className="p-2">{fmtNum(i.kg)}</td>
                    <td className="p-2">
                      <button
                        onClick={() => removeItem(idx)}
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-100"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={4} className="p-4 text-gray-500">
                      No hay materiales en este pedido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={addItem}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Añadir material
          </button>
        </div>
      )}
    </main>
  );
}
