"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";
import MaterialPicker from "@/components/MaterialPicker";

type PedidoItem = {
  material_id: string;
  nombre: string;
  bultos: number;
  kg: number;
};

export default function NuevoPedidoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();

  const zonaId = searchParams.get("zonaId");
  const zonaNombre = searchParams.get("zonaNombre");

  const [solicitante, setSolicitante] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [saving, setSaving] = useState(false);

  function agregarMaterial(
    id: string,
    meta?: { nombre: string; presentacion_kg_por_bulto: number }
  ) {
    if (!meta) return;
    setItems((prev) => [
      ...prev,
      {
        material_id: id,
        nombre: meta.nombre,
        bultos: 1,
        kg: meta.presentacion_kg_por_bulto,
      },
    ]);
  }

  async function guardarPedido() {
    if (!zonaId) {
      notify("Error: no se detectó la zona del pedido.", "error");
      return;
    }
    if (items.length === 0) {
      notify("Debe agregar al menos un material.", "error");
      return;
    }

    setSaving(true);

    // Crear pedido
    const hoy = new Date().toISOString().slice(0, 10);

    const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
        zona_id: zonaId,
        solicitante,
        fecha_pedido: hoy, // 👈 obligatorio
        fecha_entrega: fechaEntrega || null,
        notas,
        estado: "enviado",
        total_bultos: items.reduce((sum, it) => sum + it.bultos, 0),
        total_kg: items.reduce((sum, it) => sum + it.kg, 0),
    })
    .select("id")
    .single();


    if (error) {
      setSaving(false);
      notify("Error creando pedido: " + error.message, "error");
      return;
    }

    // Insertar ítems
    const pedidoId = pedido.id;
    const itemsToInsert = items.map((it) => ({
      pedido_id: pedidoId,
      material_id: it.material_id,
      bultos: it.bultos,
      kg: it.kg,
    }));

    const { error: errorItems } = await supabase
      .from("pedido_items")
      .insert(itemsToInsert);

    setSaving(false);

    if (errorItems) {
      notify("Error agregando materiales: " + errorItems.message, "error");
    } else {
      notify("Pedido creado ✅", "success");
      router.push(`/pedidos/${pedidoId}`);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">➕ Nuevo pedido</h1>
        <p className="text-gray-500 text-sm">
          Estás creando un pedido para la planta{" "}
          <span className="font-semibold">{zonaNombre || "Desconocida"}</span>.
        </p>
      </header>

      {/* Datos básicos */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div>
          <label className="text-sm font-medium">Solicitante</label>
          <input
            type="text"
            value={solicitante}
            onChange={(e) => setSolicitante(e.target.value)}
            className="w-full rounded-lg border px-3 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Fecha de entrega</label>
          <input
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            className="w-full rounded-lg border px-3 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-lg border px-3 py-1 text-sm"
          />
        </div>
      </div>

      {/* Materiales */}
      <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold">Materiales</h2>
        {zonaId && <MaterialPicker zonaId={zonaId} onChange={agregarMaterial} />}
        {items.length > 0 && (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Material</th>
                <th className="p-2">Bultos</th>
                <th className="p-2">Kg</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">{it.nombre}</td>
                  <td className="p-2" align="center">
                    <input
                      type="number"
                      value={it.bultos}
                      min={1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  bultos: val,
                                  kg: val * (p.kg / p.bultos || 1),
                                }
                              : p
                          )
                        );
                      }}
                      className="w-20 border rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="p-2" align="center">{it.kg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={guardarPedido}
          disabled={saving}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar pedido"}
        </button>
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
