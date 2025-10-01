import { useToast } from "@/components/toastprovider";

export default function PedidoEditorClient({ pedidoId }: { pedidoId: string }) {
  const { notify } = useToast();

  async function guardarTodo() {
    try {
      // ... lógica de guardado
      notify("Pedido guardado correctamente ✅", "success");
    } catch (e: any) {
      notify("Error al guardar: " + e.message, "error");
    }
  }

  // resto del componente...
}
