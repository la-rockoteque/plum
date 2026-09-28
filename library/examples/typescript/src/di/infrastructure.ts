import type { Notifier } from "./application.js";

export class ConsoleNotifier implements Notifier {
  send(message: string): void {
    console.log(message);
  }
}

export class RecordingNotifier implements Notifier {
  readonly messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }
}
