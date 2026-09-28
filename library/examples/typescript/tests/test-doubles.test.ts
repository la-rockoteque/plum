import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuditLogger,
  CancelOrder,
  Mailer,
  Order,
  OrderRepository,
  PaymentGateway,
} from "../src/test-doubles/after.js";
import { CancelOrder as BeforeCancelOrder, Order as BeforeOrder } from "../src/test-doubles/before.js";

test("before: cancelling an order blows up instead of completing", () => {
  const order = new BeforeOrder("order-1", "ada@example.com", 5);
  assert.throws(() => new BeforeCancelOrder().execute(order), /network unavailable/);
  // Nothing about the business outcome is observable: the order never even changed status.
  assert.equal(order.status, "placed");
});

// Dummy: satisfies the constructor. If a test ever asserted on this, it wouldn't be a dummy anymore.
class NullAuditLogger implements AuditLogger {
  log(_message: string): void {
    throw new Error("dummy should never be called");
  }
}

// Fake: real find/save behaviour, no external system.
class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  constructor(orders: Order[]) {
    for (const order of orders) this.orders.set(order.id, order);
  }

  findById(orderId: string): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`unknown order ${orderId}`);
    return order;
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
  }
}

// Stub: a canned response. Nothing is recorded, nothing is verified.
class StubPaymentGateway implements PaymentGateway {
  charge(_orderId: string, _amount: number): void {}
}

// Mock: a hand-rolled expectation. The wrong call fails immediately; the right one is recorded.
class MockPaymentGateway implements PaymentGateway {
  called = false;

  constructor(
    private readonly expectedOrderId: string,
    private readonly expectedAmount: number,
  ) {}

  charge(orderId: string, amount: number): void {
    if (orderId !== this.expectedOrderId || amount !== this.expectedAmount) {
      throw new Error(`unexpected charge: ${orderId} ${amount}`);
    }
    this.called = true;
  }
}

// Spy: records what was sent so the test can assert afterwards (state verification).
class SpyMailer implements Mailer {
  sent: Array<[string, string]> = [];

  send(to: string, message: string): void {
    this.sent.push([to, message]);
  }
}

function anOrder(fee = 5): Order {
  return new Order("order-1", "ada@example.com", fee);
}

test("after: dummy audit logger is passed but never called", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder()]);
  const useCase = new CancelOrder(orders, new StubPaymentGateway(), new SpyMailer(), new NullAuditLogger());
  useCase.execute("order-1"); // would throw if the dummy were ever invoked
});

test("after: stub gateway returns a canned charge result", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder()]);
  const mailer = new SpyMailer();
  new CancelOrder(orders, new StubPaymentGateway(), mailer, new NullAuditLogger()).execute("order-1");
  // The stub's canned response is enough to let the use case reach the mailer.
  assert.ok(mailer.sent.length > 0);
});

test("after: spy mailer records the message it sent", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder()]);
  const mailer = new SpyMailer();
  new CancelOrder(orders, new StubPaymentGateway(), mailer, new NullAuditLogger()).execute("order-1");
  assert.deepEqual(mailer.sent, [["ada@example.com", "Your order order-1 was cancelled"]]);
});

test("after: mock gateway accepts the expected charge", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder()]);
  const gateway = new MockPaymentGateway("order-1", 5);
  new CancelOrder(orders, gateway, new SpyMailer(), new NullAuditLogger()).execute("order-1");
  assert.equal(gateway.called, true);
});

test("after: mock gateway rejects an unexpected amount", () => {
  const orders: OrderRepository = new InMemoryOrderRepository([anOrder(999)]);
  const gateway: PaymentGateway = new MockPaymentGateway("order-1", 5);
  assert.throws(
    () => new CancelOrder(orders, gateway, new SpyMailer(), new NullAuditLogger()).execute("order-1"),
    /unexpected charge/,
  );
});

test("after: fake repository saves the cancelled order", () => {
  const orders = new InMemoryOrderRepository([anOrder()]);
  new CancelOrder(orders, new StubPaymentGateway(), new SpyMailer(), new NullAuditLogger()).execute("order-1");
  // Real behaviour: a later read reflects what an earlier write saved.
  assert.equal(orders.findById("order-1").status, "cancelled");
});
