export type PedidoEstado = "borrador" | "enviado" | "recibido" | "completado";

export type Pedido = {
  id: string;
  fecha_pedido: string;
  fecha_entrega: string | null;
  solicitante: string | null;
  estado: PedidoEstado;
  total_bultos?: number | null;
  total_kg?: number | null;
};

export type MaterialRow = {
  id: string;
  nombre: string;
  cobertura: number | null;
};

export type MaterialConConsumo = {
  id: string;
  nombre: string;
  tasa_consumo_diaria_kg: number | null;
  unidad_medida: "bulto" | "unidad" | "litro" | null;
  presentacion_kg_por_bulto: number | null;
};
