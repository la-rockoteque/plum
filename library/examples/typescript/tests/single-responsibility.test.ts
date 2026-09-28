import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditLog } from "../src/single-responsibility/after/audit-log.js";
import type { Auditor, Notifier } from "../src/single-responsibility/after/cancel-order.js";
import { CancelOrder } from "../src/single-responsibility/after/cancel-order.js";
import type { Order as AfterOrder, OrderStatus as AfterOrderStatus } from "../src/single-responsibility/after/order.js";
import { OrderNotifier } from "../src/single-responsibility/after/order-notifier.js";
import type { Order as BeforeOrder, OrderStatus as BeforeOrderStatus } from "../src/single-responsibility/before.js";
import { OrderService } from "../src/single-responsibility/before.js";

function beforeOrder(status: BeforeOrderStatus = "pending"): BeforeOrder {
  return { id: 1, customerName: "Ada", customerEmail: "ada@example.com", status };
}

function afterOrder(status: AfterOrderStatus = "pending"): AfterOrder {
  return { id: 1, customerName: "Ada", customerEmail: "ada@example.com", status };
}

// Satisfies CancelOrder's Notifier port; records only (orderId, reason),
// never the wording OrderNotifier produces from it.
class NotifierSpy implements Notifier {
  readonly notified: Array<[number, string]> = [];

  notifyCancelled(order: AfterOrder, reason: string): void {
    this.notified.push([order.id, reason]);
  }
}

// Satisfies CancelOrder's Auditor port; records only (orderId, reason),
// never the format AuditLog produces from it.
class AuditorSpy implements Auditor {
  readonly audited: Array<[number, string]> = [];

  recordCancelled(order: AfterOrder, reason: string): void {
    this.audited.push([order.id, reason]);
  }
}

test("before: cancelling a shipped order is rejected", () => {
  const service = new OrderService();
  const order = beforeOrder("shipped");
  assert.throws(
    () => service.cancel(order, "changed my mind"),
    /cannot cancel a shipped or cancelled order/,
  );
  assert.equal(order.status, "shipped");
  assert.deepEqual(service.sentEmails, []);
  assert.deepEqual(service.auditLog, []);
});

test("before: cancelling a cancelled order is rejected", () => {
  const service = new OrderService();
  const order = beforeOrder("cancelled");
  assert.throws(
    () => service.cancel(order, "changed my mind"),
    /cannot cancel a shipped or cancelled order/,
  );
  assert.equal(order.status, "cancelled");
  assert.deepEqual(service.sentEmails, []);
  assert.deepEqual(service.auditLog, []);
});

test("before: cancelling a pending order sends the confirmation email", () => {
  const service = new OrderService();
  const order = beforeOrder();
  service.cancel(order, "changed my mind");
  assert.equal(order.status, "cancelled");
  assert.deepEqual(service.sentEmails, [
    "Dear Ada, your order 1 was cancelled. Reason: changed my mind.",
  ]);
});

test("before: cancelling a pending order writes an audit entry", () => {
  const service = new OrderService();
  const order = beforeOrder();
  service.cancel(order, "changed my mind");
  assert.deepEqual(service.auditLog, ["1|CANCELLED|changed my mind"]);
});

test("before: the rule test is coupled to two email wordings", () => {
  // Change cost: cancel() cannot be exercised without producing the email,
  // so the same test that proves the cancellation rule must also pin the
  // exact wording — for any reason text. Two reasons, two literal strings,
  // one test (this one, not a notifier's) to edit either way.
  const cases: Array<[string, string]> = [
    ["changed my mind", "Dear Ada, your order 1 was cancelled. Reason: changed my mind."],
    ["duplicate order", "Dear Ada, your order 1 was cancelled. Reason: duplicate order."],
  ];
  for (const [reason, wording] of cases) {
    const service = new OrderService();
    const order = beforeOrder();
    service.cancel(order, reason);
    assert.equal(order.status, "cancelled");
    assert.deepEqual(service.sentEmails, [wording]);
  }
});

test("after: cancelling a shipped order is rejected before notifying or auditing", () => {
  const notifier = new NotifierSpy();
  const auditLog = new AuditorSpy();
  const useCase = new CancelOrder(notifier, auditLog);
  const order = afterOrder("shipped");
  assert.throws(
    () => useCase.execute(order, "changed my mind"),
    /cannot cancel a shipped or cancelled order/,
  );
  assert.equal(order.status, "shipped");
  assert.deepEqual(notifier.notified, []);
  assert.deepEqual(auditLog.audited, []);
});

test("after: cancelling a cancelled order is rejected before notifying or auditing", () => {
  const notifier = new NotifierSpy();
  const auditLog = new AuditorSpy();
  const useCase = new CancelOrder(notifier, auditLog);
  const order = afterOrder("cancelled");
  assert.throws(
    () => useCase.execute(order, "changed my mind"),
    /cannot cancel a shipped or cancelled order/,
  );
  assert.equal(order.status, "cancelled");
  assert.deepEqual(notifier.notified, []);
  assert.deepEqual(auditLog.audited, []);
});

test("after: cancelling a pending order notifies and audits through its ports", () => {
  const notifier = new NotifierSpy();
  const auditLog = new AuditorSpy();
  const useCase = new CancelOrder(notifier, auditLog);
  const order = afterOrder();
  useCase.execute(order, "changed my mind");
  assert.equal(order.status, "cancelled");
  assert.deepEqual(notifier.notified, [[1, "changed my mind"]]);
  assert.deepEqual(auditLog.audited, [[1, "changed my mind"]]);
});

test("after: the notifier formats the cancellation email on its own", () => {
  const notifier = new OrderNotifier();
  notifier.notifyCancelled(afterOrder(), "changed my mind");
  assert.deepEqual(notifier.sent, ["Dear Ada, your order 1 was cancelled. Reason: changed my mind."]);
});

test("after: the audit log records the cancellation on its own", () => {
  const auditLog = new AuditLog();
  auditLog.recordCancelled(afterOrder(), "changed my mind");
  assert.deepEqual(auditLog.entries, ["1|CANCELLED|changed my mind"]);
});
