import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditLog } from "../src/single-responsibility/after/audit-log.js";
import { CancelOrder } from "../src/single-responsibility/after/cancel-order.js";
import type { Order as AfterOrder } from "../src/single-responsibility/after/order.js";
import { OrderNotifier } from "../src/single-responsibility/after/order-notifier.js";
import type { Order as BeforeOrder } from "../src/single-responsibility/before.js";
import { OrderService } from "../src/single-responsibility/before.js";

function beforeOrder(status = "pending"): BeforeOrder {
  return { id: "O-1", customerName: "Ada", customerEmail: "ada@example.com", status };
}

function afterOrder(status = "pending"): AfterOrder {
  return { id: "O-1", customerName: "Ada", customerEmail: "ada@example.com", status };
}

test("before: cancelling a shipped order is rejected", () => {
  const service = new OrderService();
  const order = beforeOrder("shipped");
  assert.throws(() => service.cancel(order, "changed my mind"), /cannot cancel a shipped order/);
  assert.equal(order.status, "shipped");
  assert.deepEqual(service.sentEmails, []);
  assert.deepEqual(service.auditLog, []);
});

test("before: cancelling a pending order sends the confirmation email", () => {
  const service = new OrderService();
  const order = beforeOrder();
  service.cancel(order, "changed my mind");
  assert.equal(order.status, "cancelled");
  assert.deepEqual(service.sentEmails, [
    "Dear Ada, your order O-1 was cancelled. Reason: changed my mind.",
  ]);
});

test("before: cancelling a pending order writes an audit entry", () => {
  const service = new OrderService();
  const order = beforeOrder();
  service.cancel(order, "changed my mind");
  assert.deepEqual(service.auditLog, ["O-1|CANCELLED|changed my mind"]);
});

test("after: cancelling a shipped order is rejected before notifying or auditing", () => {
  const notifier = new OrderNotifier();
  const auditLog = new AuditLog();
  const useCase = new CancelOrder(notifier, auditLog);
  const order = afterOrder("shipped");
  assert.throws(() => useCase.execute(order, "changed my mind"), /cannot cancel a shipped order/);
  assert.equal(order.status, "shipped");
  assert.deepEqual(notifier.sent, []);
  assert.deepEqual(auditLog.entries, []);
});

test("after: cancelling a pending order notifies and audits through its collaborators", () => {
  const notifier = new OrderNotifier();
  const auditLog = new AuditLog();
  const useCase = new CancelOrder(notifier, auditLog);
  const order = afterOrder();
  useCase.execute(order, "changed my mind");
  assert.equal(order.status, "cancelled");
  assert.deepEqual(notifier.sent, ["Dear Ada, your order O-1 was cancelled. Reason: changed my mind."]);
  assert.deepEqual(auditLog.entries, ["O-1|CANCELLED|changed my mind"]);
});

test("after: the notifier formats the cancellation email on its own", () => {
  const notifier = new OrderNotifier();
  notifier.notifyCancelled(afterOrder(), "changed my mind");
  assert.deepEqual(notifier.sent, ["Dear Ada, your order O-1 was cancelled. Reason: changed my mind."]);
});

test("after: the audit log records the cancellation on its own", () => {
  const auditLog = new AuditLog();
  auditLog.recordCancelled(afterOrder(), "changed my mind");
  assert.deepEqual(auditLog.entries, ["O-1|CANCELLED|changed my mind"]);
});
