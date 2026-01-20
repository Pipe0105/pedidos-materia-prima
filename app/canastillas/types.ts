export enum CrateType {
  LARGE = "Grande",
  SMALL = "Pequeña",
  STANDARD = "Base",
  SPECIALTY = "Huacal",
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
