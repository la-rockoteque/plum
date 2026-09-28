# Kotlin / JVM

Requires JDK 17. The Gradle wrapper downloads Gradle and dependencies on first run;
no separate Kotlin or Gradle installation is needed. Set `JAVA_HOME` to your JDK 17
installation if Java isn't discovered automatically. From this directory:

```sh
./gradlew test
./gradlew run --args=memory
./gradlew run --args=sqlite
```

On Windows, use `gradlew.bat`. Both demos print `Order 1: cancelled`.

Under `src/main/kotlin/example/`, read `before/BeforeRepository.kt`, then `domain/`
and `application/`, then `infrastructure/`. `Demo.kt` selects the adapter and owns
the connection. Both branches invoke the same demonstration function.

Kotlin explicitly implements the application interface, uses nullable `Order?`
for a missing order, and uses exceptions for application/domain failures. The
in-memory adapter uses data-class `copy()` so mutation requires `save()`.
Application tests use only that adapter; integration tests run the same storage
contract with SQLite as well.

[Xerial SQLite JDBC](https://github.com/xerial/sqlite-jdbc) supplies the driver and
native SQLite library. JDBC connections retain their default `autoCommit=true`:
each write commits one statement. `use` closes statements, result sets, and the
demo connection. The read/cancel/save sequence isn't atomic across concurrent
writers; keep this example sequential.

See the [main walkthrough](../../README.md) for dependency direction and trade-offs.

## Dependency Injection and Dependency Inversion

```sh
./gradlew diDemo --args=before
./gradlew diDemo --args=injection
./gradlew diDemo --args=console
./gradlew diDemo --args=recording
```

Under `src/main/kotlin/example/di/`, read `before/`, `injectiononly/`,
`application/`, `infrastructure/`, then `Demo.kt`. `./gradlew test` includes this
batch's tests. See the [DI/DIP walkthrough](../../docs/dependency-injection.md).

## CQRS

```sh
./gradlew cqrsDemo --args=before
./gradlew cqrsDemo --args=memory
./gradlew cqrsDemo --args=sqlite
```

Read `src/main/kotlin/example/cqrs/`: the before service, queries, readers, then
the demo. The command reuses the original `CancelOrder`; the summary is display data.
`./gradlew test` includes unit and SQLite integration tests.
See the [CQRS walkthrough](../../docs/cqrs.md).

## ORMs

```sh
./gradlew test
./gradlew ormDemo --args=raw
./gradlew ormDemo --args=orm
./gradlew ormDemo --args=sql
```

The wrapper resolves Exposed's core, JDBC, and DAO modules. Read
`src/main/kotlin/example/orm/`. ORM modes use a temporary SQLite file, deleted
on exit, to share storage across transaction connections. `sql` prints generated
SQL. See the [ORM walkthrough](../../docs/orms.md).

## Unit of Work

```sh
./gradlew uowDemo
```

Runs three checked scenarios: partial saves before adding a transaction, rollback
after a missing order, and a successful two-order commit. Uses the existing ORM
dependencies. See the [shared walkthrough](../../docs/unit-of-work.md) for
transaction ownership, flush versus commit, and implementation links.
