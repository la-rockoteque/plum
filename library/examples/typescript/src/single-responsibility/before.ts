export type OrderStatus = "pending" | "shipped" | "cancelled";

export interface Order {
  id: number;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
}

// Cancels an order, formats the customer email, and writes the audit log —
// three reasons to change: the cancellation rule, the email wording, and the
// audit format.
export class OrderService {
  readonly sentEmails: string[] = [];
  readonly auditLog: string[] = [];

  cancel(order: Order, reason: string): void {
    if (order.status === "shipped" || order.status === "cancelled") {
      throw new Error("cannot cancel a shipped or cancelled order");
    }
    order.status = "cancelled";
    this.sentEmails.push(
      `Dear ${order.customerName}, your order ${order.id} was cancelled. Reason: ${reason}.`,
    );
    this.auditLog.push(`${order.id}|CANCELLED|${reason}`);
  }
}
