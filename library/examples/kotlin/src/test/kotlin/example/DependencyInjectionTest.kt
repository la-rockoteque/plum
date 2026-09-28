package example

import example.di.application.Notifier
import example.di.application.WelcomeUser
import example.di.before.WelcomeUser as BeforeWelcomeUser
import example.di.infrastructure.ConsoleNotifier
import example.di.infrastructure.RecordingNotifier
import example.di.injectiononly.WelcomeUser as InjectedWelcomeUser
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class DependencyInjectionTest {
    @Test
    fun injectedRecorderReceivesMessage() {
        val notifier = RecordingNotifier()
        WelcomeUser(notifier).execute("  Ada  ")
        assertEquals(listOf("Welcome, Ada!"), notifier.messages)
    }

    @Test
    fun invalidNameDoesNotNotify() {
        val notifier = RecordingNotifier()
        assertFailsWith<IllegalArgumentException> { WelcomeUser(notifier).execute(" \t ") }
        assertEquals(emptyList(), notifier.messages)
    }

    @Test
    fun notifierFailureReachesCaller() {
        val failure = IllegalStateException("Delivery failed")
        val notifier = object : Notifier {
            override fun send(message: String) { throw failure }
        }
        assertSame(failure, assertFailsWith<IllegalStateException> {
            WelcomeUser(notifier).execute("Ada")
        })
    }

    @Test
    fun consoleStagesPreserveBehavior() {
        val original = System.out
        val output = ByteArrayOutputStream()
        PrintStream(output).use { stream ->
            try {
                System.setOut(stream)
                BeforeWelcomeUser().execute(" Ada ")
                InjectedWelcomeUser(ConsoleNotifier()).execute(" Ada ")
                WelcomeUser(ConsoleNotifier()).execute(" Ada ")
            } finally {
                System.setOut(original)
            }
        }
        assertEquals("Welcome, Ada!${System.lineSeparator()}".repeat(3), output.toString())
    }
}
