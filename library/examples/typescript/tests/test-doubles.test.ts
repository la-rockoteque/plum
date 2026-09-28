import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuditLogger,
  CancelOrder,
  ChargeResult,
  Mailer,
  Order,
  OrderRepository,
  PaymentGateway,
} from "../src/test-doubles/after.js";
import { CancelOrder as BeforeCancelOrder, Order as BeforeOrder } from "../src/test-doubles/before.js";

test("before: cancelling an order blows up instead of completing", () => {
  const order = new BeforeOrder(1, "ada@example.com", 500);
  assert.throws(() => new BeforeCancelOrder().execute(order), /network unavailable/);
  // Nothing about the business outcome is observable: the order never even changed status.
  assert.equal(order.status, "pending");
});

// Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore.
class NullAuditLogger implements AuditLogger {
  log(_message: string): void {
    throw new Error("dummy should never be called");
  }
}

// Spy: records the decline message so the test can assert afterwards. The audit logger
// becomes a real collaborator once a charge is declined.
class SpyAuditLogger implements AuditLogger {
  messages: string[] = [];

  log(message: string): void {
    this.messages.push(message);
  }
}

function copyOrder(order: Order): Order {
  return new Order(order.id, order.customerEmail, order.amountMinor, order.status);
}

// Fake: real get/save behaviour, no external system. Copies on write and on read, so
// mutating what get() returns never leaks into storage until save() is called.
class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<number, Order>();

  constructor(orders: Order[]) {
    for (const order of orders) this.orders.set(order.id, copyOrder(order));
  }

  get(orderId: number): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`unknown order ${orderId}`);
    return copyOrder(order);
  }

  save(order: Order): void {
    this.orders.set(order.id, copyOrder(order));
  }
}

// Stub: a canned response. Nothing is recorded, nothing is verified.
class StubPaymentGateway implements PaymentGateway {
  constructor(private readonly result: ChargeResult) {}

  charge(_orderId: number, _amountMinor: number): ChargeResult {
    return this.result;
  }
}

// Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded.
class MockPaymentGateway implements PaymentGateway {
  called = false;

  constructor(
    private readonly expectedOrderId: number,
    private readonly expectedAmountMinor: number,
  ) {}

  charge(orderId: number, amountMinor: number): ChargeResult {
    if (orderId !== this.expectedOrderId || amountMinor !== this.expectedAmountMinor) {
      throw new Error(`unexpected charge: ${orderId} ${amountMinor}`);
    }
    this.called = true;
    return "approved";
  }
}

// Spy: records what was sent so the test can assert afterwards (state verification).
class SpyMailer implements Mailer {
  sent: Array<[string, string]> = [];

  send(to: string, message: string): void {
    this.sent.push([to, message]);
  }
}

function anOrder(amountMinor = 500): Order {
  return new Order(1, "ada@example.com", amountMinor);
}

test("after: dummy audit logger is passed but never called", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder()]);
  const useCase = new CancelOrder(orders, new StubPaymentGateway("approved"), new SpyMailer(), new NullAuditLogger());
  useCase.execute(1); // would throw if the dummy were ever invoked
});

test("after: stub gateway returns a canned decline and the order is not cancelled", () => {
  const orders = new InMemoryOrderRepository([anOrder()]);
  const audit = new SpyAuditLogger();
  new CancelOrder(orders, new StubPaymentGateway("declined"), new SpyMailer(), audit).execute(1);
  // The stub's canned decline is enough to keep the order out of the cancelled state...
  assert.equal(orders.get(1).status, "pending");
  // ...and it drove a real call to the audit logger, which is no longer dead code.
  assert.deepEqual(audit.messages, ["charge declined for order 1"]);
});

test("after: spy mailer records the message it sent", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder()]);
  const mailer = new SpyMailer();
  new CancelOrder(orders, new StubPaymentGateway("approved"), mailer, new NullAuditLogger()).execute(1);
  assert.deepEqual(mailer.sent, [["ada@example.com", "Your order 1 was cancelled"]]);
});

test("after: mock gateway fails immediately on the wrong charge but accepts the right one", () => {
  const wrongOrders = new InMemoryOrderRepository([anOrder(99900)]);
  const wrongGateway = new MockPaymentGateway(1, 500);
  assert.throws(
    () => new CancelOrder(wrongOrders, wrongGateway, new SpyMailer(), new NullAuditLogger()).execute(1),
    /unexpected charge/,
  );

  const orders = new InMemoryOrderRepository([anOrder()]);
  const gateway = new MockPaymentGateway(1, 500);
  new CancelOrder(orders, gateway, new SpyMailer(), new NullAuditLogger()).execute(1);
  assert.equal(gateway.called, true);
});

test("after: fake repository saves the cancelled order", () => {
  const orders = new InMemoryOrderRepository([anOrder()]);
  new CancelOrder(orders, new StubPaymentGateway("approved"), new SpyMailer(), new NullAuditLogger()).execute(1);
  // Real behaviour: a later read reflects what an earlier write saved. If save() were
  // deleted, get() would still return the untouched copy stored at construction time.
  assert.equal(orders.get(1).status, "cancelled");
});
