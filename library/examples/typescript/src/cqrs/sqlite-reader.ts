import type { DatabaseSync } from "node:sqlite";
import type { OrderSummary, OrderSummaryReader } from "./queries.js";

export class SqliteOrderSummaryReader implements OrderSummaryReader {
  constructor(private readonly database: DatabaseSync) {}

  getSummary(orderId: number): OrderSummary | undefined {
    // Project straight into display data; don't load a domain entity.
    const row = this.database.prepare(
      "SELECT id, status, status = 'pending' AS can_cancel FROM orders WHERE id = ?",
    ).get(orderId) as { id: unknown; status: unknown; can_cancel: unknown } | undefined;
    if (!row) return undefined;
    if (typeof row.id !== "number" || !Number.isSafeInteger(row.id) ||
        typeof row.status !== "string" || (row.can_cancel !== 0 && row.can_cancel !== 1)) {
      throw new Error("Invalid order summary row");
    }
    return { id: row.id, status: row.status, canCancel: row.can_cancel === 1 };
  }
}
