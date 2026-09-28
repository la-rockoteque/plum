import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CancellationOutcome,
  Notifier,
  Order,
  OrderRepository,
  OrderStatus,
  PostRefactorService,
} from "../src/testing-through-public-api/post-refactor.js";
import { PreRefactorService } from "../src/testing-through-public-api/pre-refactor.js";

function cloneOrder(order: Order): Order {
  return new Order(order.id, order.amountMinor, order.status);
}

// Fake: real find/save behaviour, no external system. Copies on write and read, so a caller
// can't observe state through a reference it never went through the repository for.
class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<number, Order>();

  constructor(orders: Order[]) {
    for (const order of orders) this.orders.set(order.id, cloneOrder(order));
  }

  findById(orderId: number): Order {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`unknown order ${orderId}`);
    return cloneOrder(order);
  }

  save(order: Order): void {
    this.orders.set(order.id, cloneOrder(order));
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
  calledWith: [number, number] | undefined;

  format(orderId: number, refundAmountMinor: number): string {
    this.calledWith = [orderId, refundAmountMinor];
    return "mocked notification";
  }
}

function anOrder(id = 1, amountMinor = 5000): Order {
  return new Order(id, amountMinor);
}

// --- before: internal-poking tests -------------------------------------------------------------

test("before: poking the private fee helper and field passes against the pre-refactor implementation", () => {
  const order = anOrder();
  const service = new PreRefactorService(new InMemoryOrderRepository([order]), new SpyNotifier());
  const internals = service as unknown as { calculateFee(order: Order): number; feeRate: number };
  // Reach past cancel() and call the private helper directly.
  assert.equal(internals.calculateFee(order), 500);
  // Assert on a private field instead of an observable outcome.
  assert.equal(internals.feeRate, 0.1);
});

test("before: mocking the service's own formatter passes but couples the test to implementation", () => {
  const order = anOrder();
  const service = new PreRefactorService(new InMemoryOrderRepository([order]), new SpyNotifier());
  const mockFormatter = new MockNotificationFormatter();
  // Reach in and replace a collaborator the service built for itself.
  (service as unknown as { formatter: MockNotificationFormatter }).formatter = mockFormatter;
  service.cancel(1);
  assert.deepEqual(mockFormatter.calledWith, [1, 4500]);
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
  cancel(orderId: number): CancellationOutcome;
}): void {
  const outcome = service.cancel(1);
  assert.equal(outcome.orderId, 1);
  assert.equal(outcome.refundAmountMinor, 4500);
  assert.equal(outcome.status, OrderStatus.Cancelled);
  // Observable via the fake repository: state was actually persisted.
  assert.equal(service.orders.findById(1).status, OrderStatus.Cancelled);
  // Observable via the notifier spy: the right message was sent.
  assert.deepEqual((service.notifier as SpyNotifier).sent, ["Order 1 cancelled; refund 4500"]);
}

test("after: cancelling through the public api behaves identically against the pre-refactor implementation", () => {
  const service = new PreRefactorService(new InMemoryOrderRepository([anOrder()]), new SpyNotifier());
  assertCancellingOrder1BehavesCorrectly(service);
});

test("after: cancelling through the public api behaves identically against the post-refactor implementation", () => {
  const service = new PostRefactorService(new InMemoryOrderRepository([anOrder()]), new SpyNotifier());
  assertCancellingOrder1BehavesCorrectly(service);
});
