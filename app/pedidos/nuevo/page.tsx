"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";

export default function NuevoPedidoPage() {
  const router = useRouter();
  const { notify } = useToast();

  const [solicitante, setSolicitante] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardarPedido() {
    setSaving(true);

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        zona_id: null, // ⚠️ puedes cambiar esto para asignar la planta
        solicitante,
        fecha_entrega: fechaEntrega || null,
        notas,
        estado: "enviado", // ✅ ya no existe "borrador"
        total_bultos: 0,
        total_kg: 0,
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      notify("Error creando pedido: " + error.message, "error");
    } else {
      notify("Pedido creado ✅", "success");
      router.push(`/pedidos/${data!.id}`); // redirige al editor
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">➕ Nuevo pedido</h1>
        <p className="text-gray-500 text-sm">
          Completa la información y guarda el pedido.
        </p>
      </header>

      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Solicitante</label>
          <input
            type="text"
            value={solicitante}
            onChange={(e) => setSolicitante(e.target.value)}
            className="rounded-lg border px-3 py-1 text-sm"
            placeholder="Nombre del solicitante"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Fecha de entrega</label>
          <input
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            className="rounded-lg border px-3 py-1 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="rounded-lg border px-3 py-1 text-sm"
            placeholder="Notas adicionales"
          />
        </div>
      </div>

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
