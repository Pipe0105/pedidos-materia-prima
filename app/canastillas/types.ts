export enum CrateType {
  LARGE = "Grande",
  SMALL = "Pequeña",
  STANDARD = "Base",
}

export interface CanastillaFormValues {
  fecha: string;
  consecutivo: string;
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
