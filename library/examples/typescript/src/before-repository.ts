import type { DatabaseSync } from "node:sqlite";

export class CancelOrder {
  constructor(private readonly database: DatabaseSync) {}

  execute(orderId: number): void {
    // SQL, table/column names, and the business rule live together.
    // Tests need persistence; a storage change can force application changes.
    const row = this.database
      .prepare("SELECT status FROM orders WHERE id = ?")
      .get(orderId) as { status: string } | undefined;
    if (!row) throw new Error(`Order ${orderId} not found`);
    if (row.status === "cancelled") throw new Error(`Order ${orderId} already cancelled`);
    this.database.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId);
  }
}
