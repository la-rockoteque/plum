package example.di.infrastructure

import example.di.application.Notifier

class ConsoleNotifier : Notifier {
    override fun send(message: String) = println(message)
}

class RecordingNotifier : Notifier {
    val messages = mutableListOf<String>()

    override fun send(message: String) {
        messages.add(message)
    }
}
