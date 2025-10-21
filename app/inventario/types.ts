export type Unidad = "bulto" | "unidad" | "litro";

export type Zona = {
  id: string;
  nombre: string;
};

export type StockRow = {
  material_id: string;
  nombre: string;
  stock: number;
  stockKg: number;
  unidad: Unidad;
  hasta: string | null;
  cobertura: number | null;
};

export type ConsumoAutomaticoRow = {
  material_id: string;
  nombre: string;
  unidad: Unidad;
  stock: number;
  stockKg: number;
  consumoDiario: number | null;
  consumoDiarioKg: number | null;
  cobertura: number | null;
  hasta: string | null;
  updatedAt: string | null;
};

export type MovimientoInventario = {
  fecha: string | null;
  tipo: string;
  bultos: number | null;
  kg: number | null;
  notas: string | null;
  created_at: string;
};

export type MaterialEditar = {
  id: string;
  nombre: string;
  stockKg: number;
};

export type MaterialConsumo = {
  id: string;
  nombre: string;
  unidad: Unidad;
};
