package example.di.before

import example.di.infrastructure.ConsoleNotifier

class WelcomeUser {
    // The use case chooses, constructs, and depends on a concrete adapter.
    private val notifier = ConsoleNotifier()

    fun execute(name: String) {
        val trimmedName = name.trim()
        require(trimmedName.isNotEmpty()) { "Name is required" }
        notifier.send("Welcome, $trimmedName!")
    }
}
