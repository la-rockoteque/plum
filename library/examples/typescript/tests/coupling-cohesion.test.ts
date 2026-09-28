import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Customer as AfterCustomer,
  LoyaltyTier as AfterLoyaltyTier,
  MigratedCustomer as AfterMigratedCustomer,
  Order as AfterOrder,
  OrderService as AfterOrderService,
} from "../src/coupling-cohesion/after.js";
import {
  Customer as BeforeCustomer,
  LoyaltyTier as BeforeLoyaltyTier,
  MigratedCustomer as BeforeMigratedCustomer,
  Order as BeforeOrder,
  OrderService as BeforeOrderService,
} from "../src/coupling-cohesion/before.js";

test("before: cancellation fee and loyalty discount read the customers fields directly", () => {
  const gold: BeforeCustomer = { tier: "gold", lifetimeSpendMinor: 50_000, yearsAsMember: 1 };
  const order: BeforeOrder = { amountMinor: 10_000, customer: gold };
  const service = new BeforeOrderService();
  assert.equal(service.cancellationFee(order), 8_000);
  assert.equal(service.loyaltyDiscount(gold), 2000);

  const bigSpender: BeforeCustomer = { tier: "bronze", lifetimeSpendMinor: 150_000, yearsAsMember: 0 };
  assert.equal(service.loyaltyDiscount(bigSpender), 1000);
});

test("before: a migrated customer representation needs its own order service method", () => {
  const migrated: BeforeMigratedCustomer = {
    tier: BeforeLoyaltyTier.Gold,
    lifetimeSpendMinor: 50_000,
    yearsAsMember: 1,
  };
  const service = new BeforeOrderService();
  // Customer's tier became a value type; OrderService had to gain a whole new method to read
  // it - the change cost of reaching into Customer's representation instead of asking it.
  assert.equal(service.migratedLoyaltyDiscount(migrated), 2000);
});

test("after: cancellation fee asks the customer for its own discount", () => {
  const gold = new AfterCustomer("gold", 50_000, 1);
  const order: AfterOrder = { amountMinor: 10_000, customer: gold };
  const service = new AfterOrderService();
  assert.equal(service.cancellationFee(order), 8_000);
  assert.equal(service.loyaltyDiscount(gold), 2000);

  const bigSpender = new AfterCustomer("bronze", 150_000, 0);
  assert.equal(service.loyaltyDiscount(bigSpender), 1000);
});

test("after: order service needs no changes for a migrated customer representation", () => {
  const migrated = new AfterMigratedCustomer(AfterLoyaltyTier.Gold, 50_000, 1);
  const order: AfterOrder = { amountMinor: 10_000, customer: migrated };
  const service = new AfterOrderService();
  // Same OrderService code, unedited, gives the same answer for the new representation.
  assert.equal(service.cancellationFee(order), 8_000);
  assert.equal(service.loyaltyDiscount(migrated), 2000);
});
