import { WelcomeUser } from "./application.js";
import { WelcomeUser as BeforeWelcomeUser } from "./before.js";
import { ConsoleNotifier, RecordingNotifier } from "./infrastructure.js";
import { WelcomeUser as InjectedWelcomeUser } from "./injection-only.js";

// Composition root: construction belongs at the edge of the application.
const [stage, ...extra] = process.argv.slice(2);
switch (extra.length === 0 ? stage : undefined) {
  case "before":
    new BeforeWelcomeUser().execute("Ada");
    break;
  case "injection":
    new InjectedWelcomeUser(new ConsoleNotifier()).execute("Ada");
    break;
  case "console":
    new WelcomeUser(new ConsoleNotifier()).execute("Ada");
    break;
  case "recording": {
    const notifier = new RecordingNotifier();
    new WelcomeUser(notifier).execute("Ada");
    console.log(`Recorded: ${notifier.messages[0]}`);
    break;
  }
  default:
    console.error("Usage: npm run demo:di -- before|injection|console|recording");
    process.exitCode = 1;
}
