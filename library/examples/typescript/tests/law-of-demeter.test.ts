import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Address as AfterAddress,
  CancellationPolicy as AfterCancellationPolicy,
  Country as AfterCountry,
  Customer as AfterCustomer,
  Order as AfterOrder,
  Region as AfterRegion,
  ReturnLabelPrinter as AfterReturnLabelPrinter,
} from "../src/law-of-demeter/after.js";
import {
  CancellationPolicy as BeforeCancellationPolicy,
  Order as BeforeOrder,
  ReturnLabelPrinter as BeforeReturnLabelPrinter,
} from "../src/law-of-demeter/before.js";

test("before: refund and customs decisions walk the customers address directly for ordinary addresses", () => {
  const cancellation = new BeforeCancellationPolicy();
  const labels = new BeforeReturnLabelPrinter();

  const domestic: BeforeOrder = {
    customer: { address: { country: { code: "US" }, region: null } },
  };
  assert.equal(cancellation.canAutoRefund(domestic), true);
  assert.equal(labels.needsCustomsForm(domestic), false);

  const foreign: BeforeOrder = {
    customer: { address: { country: { code: "CA" }, region: null } },
  };
  assert.equal(cancellation.canAutoRefund(foreign), false);
  assert.equal(labels.needsCustomsForm(foreign), true);
});

test("before: a region-migrated domestic address is wrongly treated as non-domestic by both distant callers", () => {
  const cancellation = new BeforeCancellationPolicy();
  const labels = new BeforeReturnLabelPrinter();

  const migratedDomestic: BeforeOrder = {
    customer: { address: { country: null, region: { country: { code: "US" } } } },
  };
  // Both callers still only know how to read `address.country`; neither has been taught
  // about `region`, so both get the same, wrong, conservative answer.
  assert.equal(cancellation.canAutoRefund(migratedDomestic), false);
  assert.equal(labels.needsCustomsForm(migratedDomestic), true);
});

test("after: order asks its customer for the same refund and customs decisions", () => {
  const cancellation = new AfterCancellationPolicy();
  const labels = new AfterReturnLabelPrinter();

  const domestic = new AfterOrder(new AfterCustomer(new AfterAddress(new AfterCountry("US"), null)));
  assert.equal(cancellation.canAutoRefund(domestic), true);
  assert.equal(labels.needsCustomsForm(domestic), false);

  const foreign = new AfterOrder(new AfterCustomer(new AfterAddress(new AfterCountry("CA"), null)));
  assert.equal(cancellation.canAutoRefund(foreign), false);
  assert.equal(labels.needsCustomsForm(foreign), true);
});

test("after: the same caller code answers correctly once address owns the region-migrated shape", () => {
  const cancellation = new AfterCancellationPolicy();
  const labels = new AfterReturnLabelPrinter();

  const migratedDomestic = new AfterOrder(
    new AfterCustomer(new AfterAddress(null, new AfterRegion(new AfterCountry("US")))),
  );
  assert.equal(cancellation.canAutoRefund(migratedDomestic), true);
  assert.equal(labels.needsCustomsForm(migratedDomestic), false);
});

test("after: a pickup point address with no country or region is treated as non-domestic without crashing", () => {
  const cancellation = new AfterCancellationPolicy();
  const labels = new AfterReturnLabelPrinter();

  const pickupPoint = new AfterOrder(new AfterCustomer(new AfterAddress(null, null)));
  assert.equal(cancellation.canAutoRefund(pickupPoint), false);
  assert.equal(labels.needsCustomsForm(pickupPoint), true);
});
