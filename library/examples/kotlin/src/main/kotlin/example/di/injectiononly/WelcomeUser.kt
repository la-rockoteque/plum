package example.di.injectiononly

import example.di.infrastructure.ConsoleNotifier

// Injection changes who constructs it, but this contract is still concrete.
class WelcomeUser(private val notifier: ConsoleNotifier) {
    fun execute(name: String) {
        val trimmedName = name.trim()
        require(trimmedName.isNotEmpty()) { "Name is required" }
        notifier.send("Welcome, $trimmedName!")
    }
}
