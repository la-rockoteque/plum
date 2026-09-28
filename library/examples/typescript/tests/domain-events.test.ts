import assert from "node:assert/strict";
import test from "node:test";
import { Order as BeforeOrder } from "../src/domain-events/before.js";
import {
  CancelOrderService,
  EventDispatcher,
  InMemoryOrderRepository,
  Order,
  OrderCancelled,
  RecordLoyaltyCancellationHandler,
  ReleaseInventoryHandler,
  SendCancellationEmailHandler,
} from "../src/domain-events/after.js";

class FixedClock {
  constructor(private readonly ms: number) {}
  nowMs(): number {
    return this.ms;
  }
}

class FakeInventoryService {
  released: number[] = [];
  release(orderId: number): void {
    this.released.push(orderId);
  }
}

class FakeMailer {
  sent: number[] = [];
  sendCancellationEmail(orderId: number): void {
    this.sent.push(orderId);
  }
}

class MailerUnavailableError extends Error {}

class FailingMailer {
  sendCancellationEmail(_orderId: number): void {
    throw new MailerUnavailableError("mailer unavailable");
  }
}

class FakeLoyaltyLedger {
  recorded: number[] = [];
  recordCancellation(orderId: number): void {
    this.recorded.push(orderId);
  }
}

class StorageUnavailableError extends Error {}

class FailingSaveOrderRepository extends InMemoryOrderRepository {
  failOnSave = false;
  override save(order: Order): void {
    if (this.failOnSave) throw new StorageUnavailableError("storage unavailable");
    super.save(order);
  }
}

test("before: cancelling calls the inventory, mailer and loyalty collaborators directly", () => {
  const inventory = new FakeInventoryService();
  const mailer = new FakeMailer();
  const loyalty = new FakeLoyaltyLedger();
  const order = new BeforeOrder(1, inventory, mailer, loyalty);
  order.cancel("customer request");
  assert.deepEqual(inventory.released, [1]);
  assert.deepEqual(mailer.sent, [1]);
  assert.deepEqual(loyalty.recorded, [1]);
  assert.equal(order.status, "cancelled");
});

test("before: a failing mailer leaves inventory released but the order not cancelled", () => {
  const inventory = new FakeInventoryService();
  const loyalty = new FakeLoyaltyLedger();
  const order = new BeforeOrder(1, inventory, new FailingMailer(), loyalty);
  assert.throws(() => order.cancel("customer request"), MailerUnavailableError);
  assert.deepEqual(inventory.released, [1]); // already ran
  assert.deepEqual(loyalty.recorded, []); // never reached
  assert.equal(order.status, "pending"); // inconsistent: inventory thinks it's released, order disagrees
});

test("after: cancel records exactly one OrderCancelled event with the right data", () => {
  const order = new Order(1);
  order.cancel("customer request", new FixedClock(1000));
  const events = order.pullEvents();
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], new OrderCancelled(1, "customer request", 1000));
  assert.equal(order.status, "cancelled");
});

test("after: cancelling through the service dispatches to every registered handler after a successful save", () => {
  const repo = new InMemoryOrderRepository();
  repo.save(new Order(1));
  const dispatcher = new EventDispatcher();
  const inventory = new FakeInventoryService();
  const mailer = new FakeMailer();
  const loyalty = new FakeLoyaltyLedger();
  dispatcher.register(OrderCancelled, new ReleaseInventoryHandler(inventory));
  dispatcher.register(OrderCancelled, new SendCancellationEmailHandler(mailer));
  dispatcher.register(OrderCancelled, new RecordLoyaltyCancellationHandler(loyalty));
  const service = new CancelOrderService(repo, dispatcher, new FixedClock(1000));

  service.cancel(1, "customer request");

  assert.deepEqual(inventory.released, [1]);
  assert.deepEqual(mailer.sent, [1]);
  assert.deepEqual(loyalty.recorded, [1]);
  assert.equal(repo.get(1)?.status, "cancelled");
});

test("after: events are not dispatched when the save fails", () => {
  const repo = new FailingSaveOrderRepository();
  repo.save(new Order(1));
  const dispatcher = new EventDispatcher();
  const mailer = new FakeMailer();
  dispatcher.register(OrderCancelled, new SendCancellationEmailHandler(mailer));
  const service = new CancelOrderService(repo, dispatcher, new FixedClock(1000));
  repo.failOnSave = true;

  assert.throws(() => service.cancel(1, "customer request"), StorageUnavailableError);

  assert.deepEqual(mailer.sent, []);
});

test("after: the inventory handler releases inventory for the cancelled order", () => {
  const inventory = new FakeInventoryService();
  const handler = new ReleaseInventoryHandler(inventory);
  handler.handle(new OrderCancelled(1, "customer request", 1000));
  assert.deepEqual(inventory.released, [1]);
});

test("after: the mailer handler sends a cancellation email", () => {
  const mailer = new FakeMailer();
  const handler = new SendCancellationEmailHandler(mailer);
  handler.handle(new OrderCancelled(1, "customer request", 1000));
  assert.deepEqual(mailer.sent, [1]);
});

test("after: the loyalty handler records the cancellation", () => {
  const loyalty = new FakeLoyaltyLedger();
  const handler = new RecordLoyaltyCancellationHandler(loyalty);
  handler.handle(new OrderCancelled(1, "customer request", 1000));
  assert.deepEqual(loyalty.recorded, [1]);
});

test("after: a failing handler does not undo the cancellation", () => {
  const repo = new InMemoryOrderRepository();
  repo.save(new Order(1));
  const dispatcher = new EventDispatcher();
  const inventory = new FakeInventoryService();
  const loyalty = new FakeLoyaltyLedger();
  dispatcher.register(OrderCancelled, new ReleaseInventoryHandler(inventory));
  dispatcher.register(OrderCancelled, new SendCancellationEmailHandler(new FailingMailer()));
  dispatcher.register(OrderCancelled, new RecordLoyaltyCancellationHandler(loyalty));
  const service = new CancelOrderService(repo, dispatcher, new FixedClock(1000));

  assert.throws(() => service.cancel(1, "customer request"), MailerUnavailableError);

  assert.equal(repo.get(1)?.status, "cancelled"); // the save already committed before the handler ran
  assert.deepEqual(inventory.released, [1]); // handler before the failing one still ran
  assert.deepEqual(loyalty.recorded, []); // handler after the failing one never ran
});
