"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";

type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: "enviado" | "recibido" | "completado";
  total_bultos?: number | null;
  total_kg?: number | null;
  notas?: string | null;
};

export default function PedidoEditor({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { notify } = useToast();

  const pedidoId = params.id;
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPedido = async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          "id, fecha_pedido, fecha_entrega, solicitante, estado, total_bultos, total_kg, notas"
        )
        .eq("id", pedidoId)
        .single();

      if (error) {
        notify("Error cargando pedido: " + error.message, "error");
      } else {
        setPedido(data);
      }
      setLoading(false);
    };

    void fetchPedido();
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
      })
      .eq("id", pedido.id);

    setSaving(false);

    if (error) {
      notify("Error al guardar: " + error.message, "error");
    } else {
      notify("Pedido actualizado ✅", "success");
      router.push("/pedidos");
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

  function badgeEstado(estado: Pedido["estado"]) {
    const base = "px-3 py-1 rounded-full text-xs font-semibold inline-block";
    switch (estado) {
      case "enviado":
        return <span className={`${base} bg-blue-100 text-blue-700`}>Enviado</span>;
      case "recibido":
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>Recibido</span>;
      case "completado":
        return <span className={`${base} bg-green-100 text-green-700`}>Completado</span>;
    }
  }

  if (loading) return <div className="p-6">Cargando pedido...</div>;
  if (!pedido) return <div className="p-6 text-red-600">Pedido no encontrado.</div>;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar pedido</h1>
          <p className="text-gray-500 text-sm">Modifica los datos y guarda los cambios.</p>
        </div>
        <div>{badgeEstado(pedido.estado)}</div>
      </header>

      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Solicitante</label>
          <input
            type="text"
            value={pedido.solicitante ?? ""}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, solicitante: e.target.value })
            }
            className="rounded-lg border px-3 py-1 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Fecha de entrega</label>
          <input
            type="date"
            value={pedido.fecha_entrega ?? ""}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, fecha_entrega: e.target.value })
            }
            className="rounded-lg border px-3 py-1 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Notas</label>
          <textarea
            value={pedido.notas ?? ""}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, notas: e.target.value })
            }
            className="rounded-lg border px-3 py-1 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Estado</label>
          <select
            value={pedido.estado}
            onChange={(e) =>
              setPedido((prev) => prev && { ...prev, estado: e.target.value as Pedido["estado"] })
            }
            className="rounded-lg border px-3 py-1 text-sm"
          >
            <option value="enviado">Enviado</option>
            <option value="recibido">Recibido</option>
            <option value="completado">Completado</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={guardarCambios}
          disabled={saving}
          className="flex items-center gap-1 rounded bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "💾 Guardando..." : "💾 Guardar cambios"}
        </button>

        {pedido.estado !== "completado" && (
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
