package example.di.application

interface Notifier {
    fun send(message: String)
}

// The application owns its contract and receives an implementation.
class WelcomeUser(private val notifier: Notifier) {
    fun execute(name: String) {
        val trimmedName = name.trim()
        require(trimmedName.isNotEmpty()) { "Name is required" }
        notifier.send("Welcome, $trimmedName!")
    }
}
