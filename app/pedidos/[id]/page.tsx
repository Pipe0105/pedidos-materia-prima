// app/pedidos/[id]/page.tsx
import PedidoEditorClient from "@/components/pedidos/PedidoEditorClient";

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  return <PedidoEditorClient pedidoId={id} />;
}
