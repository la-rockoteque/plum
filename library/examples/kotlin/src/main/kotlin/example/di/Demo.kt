package example.di

import example.di.application.WelcomeUser
import example.di.before.WelcomeUser as BeforeWelcomeUser
import example.di.infrastructure.ConsoleNotifier
import example.di.infrastructure.RecordingNotifier
import example.di.injectiononly.WelcomeUser as InjectedWelcomeUser
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    // Composition root: construction belongs at the edge of the application.
    when (args.singleOrNull()) {
        "before" -> BeforeWelcomeUser().execute("Ada")
        "injection" -> InjectedWelcomeUser(ConsoleNotifier()).execute("Ada")
        "console" -> WelcomeUser(ConsoleNotifier()).execute("Ada")
        "recording" -> {
            val notifier = RecordingNotifier()
            WelcomeUser(notifier).execute("Ada")
            println("Recorded: ${notifier.messages[0]}")
        }
        else -> {
            System.err.println("Usage: ./gradlew diDemo --args='before|injection|console|recording'")
            exitProcess(1)
        }
    }
}
