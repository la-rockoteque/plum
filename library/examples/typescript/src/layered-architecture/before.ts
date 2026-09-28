import type { DatabaseSync } from "node:sqlite";

export interface CancelRequest {
  orderId: string; // arrives as a string, as it would from a web request
}

export interface CancelResponse {
  status: "ok" | "invalid" | "not_found" | "rejected";
  message: string;
}

export function handleCancelRequest(
  request: CancelRequest,
  database: DatabaseSync,
): CancelResponse {
  // Parsing, the cancellation rule, and SQL all live in one function: a rule change
  // and a column rename both force an edit here, and proving the rule needs a database.
  if (!/^\d+$/.test(request.orderId)) {
    return { status: "invalid", message: "order id must be a number" };
  }
  const orderId = Number(request.orderId);

  const row = database
    .prepare("SELECT status FROM orders WHERE id = ?")
    .get(orderId) as { status: string } | undefined;
  if (!row) return { status: "not_found", message: `order ${orderId} not found` };
  if (row.status === "shipped" || row.status === "cancelled") {
    return { status: "rejected", message: `order ${orderId} already ${row.status}` };
  }
  database.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId);
  return { status: "ok", message: `order ${orderId} cancelled` };
}
