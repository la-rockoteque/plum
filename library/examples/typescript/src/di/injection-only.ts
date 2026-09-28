import type { ConsoleNotifier } from "./infrastructure.js";

export class WelcomeUser {
  // Injection changes who constructs it, but this contract is still concrete.
  constructor(private readonly notifier: ConsoleNotifier) {}

  execute(name: string): void {
    name = name.trim();
    if (!name) throw new Error("Name is required");
    this.notifier.send(`Welcome, ${name}!`);
  }
}
