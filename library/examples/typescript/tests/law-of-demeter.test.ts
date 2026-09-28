import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Address as AfterAddress,
  CancellationPolicy as AfterCancellationPolicy,
  Card as AfterCard,
  Country as AfterCountry,
  Customer as AfterCustomer,
  Order as AfterOrder,
  Wallet as AfterWallet,
} from "../src/law-of-demeter/after.js";
import {
  Address as BeforeAddress,
  CancellationPolicy as BeforeCancellationPolicy,
  Card as BeforeCard,
  Country as BeforeCountry,
  Customer as BeforeCustomer,
  Order as BeforeOrder,
  Wallet as BeforeWallet,
} from "../src/law-of-demeter/before.js";

test("before: shipping and refund decisions walk the customers address and wallet directly", () => {
  const policy = new BeforeCancellationPolicy();

  const domestic: BeforeOrder = {
    customer: {
      address: { country: { code: "US" } },
      wallet: { card: { expired: false } },
    },
  };
  assert.equal(policy.shipsDomestically(domestic), true);
  assert.equal(policy.canAutoRefund(domestic), true);

  const foreign: BeforeOrder = {
    customer: {
      address: { country: { code: "CA" } },
      wallet: { card: { expired: true } },
    },
  };
  assert.equal(policy.shipsDomestically(foreign), false);
  assert.equal(policy.canAutoRefund(foreign), false);
});

test("before: a pickup point address without a country breaks the shipping check", () => {
  const policy = new BeforeCancellationPolicy();
  const order: BeforeOrder = {
    customer: {
      address: { country: null },
      wallet: { card: { expired: false } },
    },
  };
  assert.throws(() => policy.shipsDomestically(order), TypeError);
});

test("after: order asks its customer who asks its own collaborators for the same decisions", () => {
  const policy = new AfterCancellationPolicy();

  const domestic = new AfterOrder(
    new AfterCustomer(
      new AfterAddress(new AfterCountry("US")),
      new AfterWallet(new AfterCard(false)),
    ),
  );
  assert.equal(policy.shipsDomestically(domestic), true);
  assert.equal(policy.canAutoRefund(domestic), true);

  const foreign = new AfterOrder(
    new AfterCustomer(
      new AfterAddress(new AfterCountry("CA")),
      new AfterWallet(new AfterCard(true)),
    ),
  );
  assert.equal(policy.shipsDomestically(foreign), false);
  assert.equal(policy.canAutoRefund(foreign), false);
});

test("after: a pickup point address without a country no longer breaks the shipping check", () => {
  const policy = new AfterCancellationPolicy();
  const order = new AfterOrder(
    new AfterCustomer(new AfterAddress(null), new AfterWallet(new AfterCard(false))),
  );
  assert.equal(policy.shipsDomestically(order), false);
  assert.equal(policy.canAutoRefund(order), true);
});
