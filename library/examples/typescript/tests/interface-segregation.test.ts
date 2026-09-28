import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CancelOrder as AfterCancelOrder,
  CancelOrderStore,
  Order as AfterOrder,
  OrderArchiver,
  OrderStoreAdapter,
} from "../src/interface-segregation/after.js";
import {
  CancelOrder as BeforeCancelOrder,
  Order as BeforeOrder,
  OrderStoreV1,
  OrderStoreV2,
} from "../src/interface-segregation/before.js";

// Implements the fat interface CancelOrder depends on. get/save are the only methods
// CancelOrder calls; the rest exist only to satisfy the contract.
class FakeOrderStoreV1 implements OrderStoreV1 {
  static readonly unusedStubs = ["delete", "listByCustomer", "exportCsv", "auditTrail", "purgeOlderThan"];

  constructor(private readonly orders: Map<number, BeforeOrder>) {}

  get(orderId: number): BeforeOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`unknown order ${orderId}`);
    return order;
  }

  save(order: BeforeOrder): void {
    this.orders.set(order.id, order);
  }

  delete(_orderId: number): void {
    throw new Error("not used");
  }

  listByCustomer(_customerEmail: string): BeforeOrder[] {
    throw new Error("not used");
  }

  exportCsv(): string {
    throw new Error("not used");
  }

  auditTrail(_orderId: number): string[] {
    throw new Error("not used");
  }

  purgeOlderThan(_days: number): number {
    throw new Error("not used");
  }
}

// The fat interface grew an eighth method (archive). CancelOrder's own behaviour is
// unchanged, but its fake must grow with the interface -- one more unused stub.
class FakeOrderStoreV2 extends FakeOrderStoreV1 implements OrderStoreV2 {
  static readonly unusedStubs = [...FakeOrderStoreV1.unusedStubs, "archive"];

  archive(_orderId: number): void {
    throw new Error("not used");
  }
}

test("before: cancel order works but its fake stubs five unused methods", () => {
  const orders = new Map([[1, new BeforeOrder(1, "ada@example.com", 500)]]);
  const store: OrderStoreV1 = new FakeOrderStoreV1(orders);
  new BeforeCancelOrder(store).execute(1);
  assert.equal(orders.get(1)?.status, "cancelled");
  assert.equal(FakeOrderStoreV1.unusedStubs.length, 5);
  assert.throws(() => store.delete(1), /not used/);
});

test("before: growing the fat store forces the cancel test's fake to grow too", () => {
  const orders = new Map([[1, new BeforeOrder(1, "ada@example.com", 500)]]);
  const store: OrderStoreV2 = new FakeOrderStoreV2(orders);
  // Cancel order's own behaviour did not change -- it still only calls get and save.
  new BeforeCancelOrder(store).execute(1);
  assert.equal(orders.get(1)?.status, "cancelled");
  // But the fake that satisfies the grown interface needed one more unused stub.
  assert.equal(FakeOrderStoreV2.unusedStubs.length, FakeOrderStoreV1.unusedStubs.length + 1);
  assert.throws(() => store.archive(1), /not used/);
});

// Implements the narrow role interface CancelOrder actually depends on: exactly two
// methods, both real.
class FakeCancelOrderStore implements CancelOrderStore {
  static readonly realMethods = ["get", "save"];

  constructor(private readonly orders: Map<number, AfterOrder>) {}

  get(orderId: number): AfterOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`unknown order ${orderId}`);
    return order;
  }

  save(order: AfterOrder): void {
    this.orders.set(order.id, order);
  }
}

test("after: cancel order's fake has exactly two methods, both real", () => {
  const orders = new Map([[1, new AfterOrder(1, "ada@example.com", 500)]]);
  const store: CancelOrderStore = new FakeCancelOrderStore(orders);
  new AfterCancelOrder(store).execute(1);
  assert.equal(orders.get(1)?.status, "cancelled");
  assert.equal(FakeCancelOrderStore.realMethods.length, 2);
});

test("after: adding a role interface for archiving does not touch cancel order or its fake", () => {
  const adapter = new OrderStoreAdapter();
  adapter.save(new AfterOrder(1, "ada@example.com", 500));
  const archiver: OrderArchiver = adapter;
  archiver.archive(1);
  assert.equal(adapter.get(1).status, "archived");
  // CancelOrder and its fake are exactly as declared above -- untouched by the new role.
  const orders = new Map([[2, new AfterOrder(2, "ada@example.com", 700)]]);
  const store: CancelOrderStore = new FakeCancelOrderStore(orders);
  new AfterCancelOrder(store).execute(2);
  assert.equal(orders.get(2)?.status, "cancelled");
  assert.equal(FakeCancelOrderStore.realMethods.length, 2);
});
