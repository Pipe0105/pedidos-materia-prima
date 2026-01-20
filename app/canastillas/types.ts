export enum CrateType {
  STANDARD = "Estándar",
  LARGE = "Grande",
  SMALL = "Pequeña",
  SPECIALTY = "Especialidad",
}

export enum CrateStatus {
  MACPOLLO = "Macpollo",
  DON_POLLO = "Don Pollo",
  GALPON = "Galpon",
}

export interface InventoryItem {
  id: string;
  type: CrateType;
  status: CrateStatus;
  quantity: number;
}
