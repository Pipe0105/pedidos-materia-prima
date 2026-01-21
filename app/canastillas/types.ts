export enum CrateType {
  LARGE = "Grande",
  SMALL = "Pequeña",
  STANDARD = "Base",
  SPECIALTY = "Huacal",
}

export interface CanastillaFormValues {
  fecha: string;
  fechaDevolucion: string;
  placaVH: string;
  nombreCliente: string;
  nombreAutoriza: string;
}

export interface InventoryItem {
  id: string;
  type: CrateType;
  provider: string;
  quantity: number;
}
