#!/usr/bin/env bash
# A tiny TypeScript service with SQL inside the use case — the repository concept's "before".
set -euo pipefail
mkdir -p src/orders
cat > package.json <<'JSON'
{ "name": "shop-api", "dependencies": { "better-sqlite3": "12.0.0" } }
JSON
cat > src/orders/order.service.ts <<'TS'
import Database from "better-sqlite3";

export class OrderService {
  constructor(private readonly db: Database.Database) {}

  cancel(id: number): void {
    const row = this.db.prepare("SELECT status FROM orders WHERE id = ?").get(id) as { status: string } | undefined;
    if (!row) throw new Error(`order ${id} not found`);
    if (row.status === "shipped") throw new Error("shipped orders can't be cancelled");
    this.db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(id);
  }
}
TS
cat > src/orders/order.service.spec.ts <<'TS'
// Needs a real database to test the cancellation rule.
TS
git init -q && git add -A && git -c user.email=e@e -c user.name=e commit -qm init
