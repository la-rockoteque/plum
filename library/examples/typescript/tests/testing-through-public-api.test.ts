import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CancellationOutcome,
  Notifier,
  Order,
  OrderRepository,
  PostRefactorService,
} from "../src/testing-through-public-api/post-refactor.js";
import { PreRefactorService } from "../src/testing-through-public-api/pre-refactor.js";

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

// Spy: records what was sent so the test can assert afterwards.
class SpyNotifier implements Notifier {
  sent: string[] = [];

  send(message: string): void {
    this.sent.push(message);
  }
}

// A hand-rolled double for the service's OWN internal collaborator - not a port.
class MockNotificationFormatter {
  calledWith: [string, number] | undefined;

  format(orderId: string, refundAmount: number): string {
    this.calledWith = [orderId, refundAmount];
    return "mocked notification";
  }
}

function anOrder(id = "order-1", total = 50): Order {
  return new Order(id, total);
}

// --- before: internal-poking tests -------------------------------------------------------------

test("before: poking the private fee helper and field passes against the pre-refactor implementation", () => {
  const order = anOrder();
  const service = new PreRefactorService(new InMemoryOrderRepository([order]), new SpyNotifier());
  const internals = service as unknown as { calculateFee(order: Order): number; feeRate: number };
  // Reach past cancel() and call the private helper directly.
  assert.equal(internals.calculateFee(order), 5);
  // Assert on a private field instead of an observable outcome.
  assert.equal(internals.feeRate, 0.1);
});

test("before: mocking the service's own formatter passes but couples the test to implementation", () => {
  const order = anOrder();
  const service = new PreRefactorService(new InMemoryOrderRepository([order]), new SpyNotifier());
  const mockFormatter = new MockNotificationFormatter();
  // Reach in and replace a collaborator the service built for itself.
  (service as unknown as { formatter: MockNotificationFormatter }).formatter = mockFormatter;
  service.cancel("order-1");
  assert.deepEqual(mockFormatter.calledWith, ["order-1", 45]);
});

test("before: the same private-poking assertions no longer hold after a pure refactor", () => {
  const order = anOrder();
  const service = new PostRefactorService(new InMemoryOrderRepository([order]), new SpyNotifier());
  const internals = service as unknown as Record<string, unknown>;
  // The helper the pre-refactor test called directly is gone: inlined into cancel().
  assert.equal(typeof internals.calculateFee, "undefined");
  // The field the pre-refactor test asserted on directly was renamed.
  assert.equal(typeof internals.feeRate, "undefined");
  assert.equal(internals.cancellationFeeRate, 0.1);
});

// --- after: public-API tests, run unmodified against both implementations -----------------------

function assertCancellingOrder1BehavesCorrectly(service: {
  orders: OrderRepository;
  notifier: Notifier;
  cancel(orderId: string): CancellationOutcome;
}): void {
  const outcome = service.cancel("order-1");
  assert.equal(outcome.orderId, "order-1");
  assert.equal(outcome.refundAmount, 45);
  assert.equal(outcome.status, "cancelled");
  // Observable via the fake repository: state was actually persisted.
  assert.equal(service.orders.findById("order-1").status, "cancelled");
  // Observable via the notifier spy: the right message was sent.
  assert.deepEqual((service.notifier as SpyNotifier).sent, ["Order order-1 cancelled; refund 45.00"]);
}

test("after: cancelling through the public api behaves identically against the pre-refactor implementation", () => {
  const service = new PreRefactorService(new InMemoryOrderRepository([anOrder()]), new SpyNotifier());
  assertCancellingOrder1BehavesCorrectly(service);
});

test("after: cancelling through the public api behaves identically against the post-refactor implementation", () => {
  const service = new PostRefactorService(new InMemoryOrderRepository([anOrder()]), new SpyNotifier());
  assertCancellingOrder1BehavesCorrectly(service);
});
