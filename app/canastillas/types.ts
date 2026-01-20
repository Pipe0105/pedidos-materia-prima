export enum CrateType {
  LARGE = "Grande",
  SMALL = "Pequeña",
  STANDARD = "Base",
  SPECIALTY = "Huacal",
}

export enum CrateProvider {
  MACPOLLO = "Macpollo",
  DON_POLLO = "Don Pollo",
  GALPON = "Galpon",
}

export interface CanastillaFormValues {
  fecha: string;
  fechaDevolucion: string;
  placaVH: string;
  nombreCliente: string;
  nombreAutoriza: string;
  observaciones: string;
}

export interface InventoryItem {
  id: string;
  type: CrateType;
  provider: CrateProvider;
  quantity: number;
}
