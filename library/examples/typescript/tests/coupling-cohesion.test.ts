import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Customer as AfterCustomer,
  Order as AfterOrder,
  OrderService as AfterOrderService,
} from "../src/coupling-cohesion/after.js";
import {
  Customer as BeforeCustomer,
  Order as BeforeOrder,
  OrderService as BeforeOrderService,
} from "../src/coupling-cohesion/before.js";

test("before: cancellation fee reads the customers tier and spend directly", () => {
  const customer: BeforeCustomer = { tier: "gold", lifetimeSpend: 500, yearsAsMember: 1 };
  const order: BeforeOrder = { amount: 100, customer };
  const service = new BeforeOrderService();
  assert.equal(service.cancellationFee(order), 75.0);
  assert.equal(service.loyaltyDiscount(customer), 0.25);
});

test("before: cancellation fee and loyalty discount disagree at the spend boundary", () => {
  const customer: BeforeCustomer = { tier: "bronze", lifetimeSpend: 1000, yearsAsMember: 0 };
  const order: BeforeOrder = { amount: 200, customer };
  const service = new BeforeOrderService();
  assert.equal(service.cancellationFee(order), 175.0); // 12.5% discount applied
  assert.equal(service.loyaltyDiscount(customer), 0); // same customer, no discount at all
});

test("after: cancellation fee asks the customer for its own discount", () => {
  const customer = new AfterCustomer("gold", 500, 1);
  const order: AfterOrder = { amount: 100, customer };
  const service = new AfterOrderService();
  assert.equal(service.cancellationFee(order), 75.0);
  assert.equal(service.loyaltyDiscount(customer), 0.25);
});

test("after: cancellation fee and loyalty discount agree at the spend boundary", () => {
  const customer = new AfterCustomer("bronze", 1000, 0);
  const order: AfterOrder = { amount: 200, customer };
  const service = new AfterOrderService();
  assert.equal(service.cancellationFee(order), 175.0);
  assert.equal(service.loyaltyDiscount(customer), 0.125);
});
