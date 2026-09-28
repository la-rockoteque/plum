import assert from "node:assert/strict";
import { test } from "node:test";
import { WelcomeUser } from "../src/di/application.js";
import { WelcomeUser as BeforeWelcomeUser } from "../src/di/before.js";
import { ConsoleNotifier, RecordingNotifier } from "../src/di/infrastructure.js";
import { WelcomeUser as InjectedWelcomeUser } from "../src/di/injection-only.js";

test("injected recorder receives the message", () => {
  const notifier = new RecordingNotifier();
  new WelcomeUser(notifier).execute("  Ada  ");
  assert.deepEqual(notifier.messages, ["Welcome, Ada!"]);
});

test("invalid name does not notify", () => {
  const notifier = new RecordingNotifier();
  assert.throws(() => new WelcomeUser(notifier).execute(" \t "), /Name is required/);
  assert.deepEqual(notifier.messages, []);
});

test("notifier failure reaches the caller", () => {
  const failure = new Error("Delivery failed");
  const notifier = { send: (_message: string): void => { throw failure; } };
  assert.throws(() => new WelcomeUser(notifier).execute("Ada"), (error) => error === failure);
});

test("console stages preserve behavior", (context) => {
  const output = context.mock.method(console, "log", () => {});
  new BeforeWelcomeUser().execute(" Ada ");
  new InjectedWelcomeUser(new ConsoleNotifier()).execute(" Ada ");
  new WelcomeUser(new ConsoleNotifier()).execute(" Ada ");
  assert.deepEqual(output.mock.calls.map((call) => call.arguments), [
    ["Welcome, Ada!"], ["Welcome, Ada!"], ["Welcome, Ada!"],
  ]);
});
