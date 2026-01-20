export enum CrateType {
  STANDARD = "Estándar",
  LARGE = "Grande",
  SMALL = "Pequeña",
  SPECIALTY = "Especialidad",
}

export enum CrateStatus {
  GOOD = "Bueno",
  DAMAGED = "Dañado",
  REPAIR = "Reparar",
}

export interface InventoryItem {
  id: string;
  type: CrateType;
  status: CrateStatus;
  quantity: number;
}
