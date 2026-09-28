export interface Notifier {
  send(message: string): void;
}

// The application owns its contract and receives an implementation.
export class WelcomeUser {
  constructor(private readonly notifier: Notifier) {}

  execute(name: string): void {
    name = name.trim();
    if (!name) throw new Error("Name is required");
    this.notifier.send(`Welcome, ${name}!`);
  }
}
