"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/toastprovider";

type Pedido = {
  id: string;
  estado: "borrador" | "enviado" | "completado";
};

export default function PedidoEditorClient({ pedidoId }: { pedidoId: string }) {
  const { notify } = useToast();
  const [pedido, setPedido] = useState<Pedido | null>(null);

  // 🔹 Cargar pedido actual
  async function cargarPedido() {
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, estado")
      .eq("id", pedidoId)
      .single();

    if (error) {
      notify("Error al cargar pedido: " + error.message, "error");
    } else {
      setPedido(data);
    }
  }

  // 🔹 Guardar (ya lo tenías)
  async function guardarTodo() {
    try {
      // ... lógica de guardado que tengas implementada
      notify("Pedido guardado correctamente ✅", "success");
    } catch (e: any) {
      notify("Error al guardar: " + e.message, "error");
    }
  }

  // 🔹 Marcar como completado
  async function marcarCompletado() {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado: "completado" })
        .eq("id", pedidoId);

      if (error) throw error;

      notify("Pedido marcado como completado ✅", "success");
      cargarPedido(); // refresca estado
    } catch (e: any) {
      notify("Error al completar pedido: " + e.message, "error");
    }
  }

  useEffect(() => {
    void cargarPedido();
  }, [pedidoId]);

  return (
    <div className="space-y-4">
      {/* Botón guardar */}
      <button
        onClick={guardarTodo}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Guardar pedido
      </button>
    </div>
  );
}
