export type OrderStatus = "pending" | "shipped" | "cancelled";

export interface Order {
  id: number;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
}
