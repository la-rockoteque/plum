import { ConsoleNotifier } from "./infrastructure.js";

export class WelcomeUser {
  // The use case chooses, constructs, and depends on a concrete adapter.
  private readonly notifier = new ConsoleNotifier();

  execute(name: string): void {
    name = name.trim();
    if (!name) throw new Error("Name is required");
    this.notifier.send(`Welcome, ${name}!`);
  }
}
