# TypeScript

Requires Node.js 22.10+ and npm. From this directory:

```sh
npm ci
npm test
npm run demo -- memory
npm run demo -- sqlite
```

Both demos print `Order 1: cancelled`. SQLite runs in memory and closes on exit.

Read `src/before-repository.ts`, then the domain and application files, then the
two infrastructure adapters. `src/demo.ts` is the composition root: both adapters
run through the same function. The repository uses a structural interface and
`undefined` for a missing order. Domain/application failures use exceptions.

Tests use Node's built-in test runner. The SQLite adapter uses
[Node's built-in SQLite API](https://nodejs.org/download/release/v22.10.0/docs/api/sqlite.html)
for the original repository batch. The scripts include `--experimental-sqlite`
for Node 22.10, which may print an experimental API warning.

This synchronous example mirrors Python; a network-backed repository would
normally use promises. Each SQLite write autocommits one statement. The caller
owns the connection; don't wrap these calls in an external transaction. The
read/cancel/save sequence doesn't protect against concurrent writers.

See the [main walkthrough](../../README.md) for dependency direction and trade-offs.

## Dependency Injection and Dependency Inversion

```sh
npm run demo:di -- before
npm run demo:di -- injection
npm run demo:di -- console
npm run demo:di -- recording
```

Read `src/di/` in this order: `before.ts`, `injection-only.ts`, `application.ts`,
`infrastructure.ts`, `demo.ts`. `npm test` includes this batch's tests.
See the [DI/DIP walkthrough](../../docs/dependency-injection.md), including the
structural-typing nuance: concrete class annotations don't necessarily prevent
substitution in TypeScript.

## CQRS

```sh
npm run demo:cqrs -- before
npm run demo:cqrs -- memory
npm run demo:cqrs -- sqlite
```

Read `src/cqrs/`: `before.ts`, `queries.ts`, the readers, then `demo.ts`.
The command reuses the original `CancelOrder`; queries return a detached summary.
`npm test` includes unit and SQLite integration tests.
See the [CQRS walkthrough](../../docs/cqrs.md).

## ORMs

```sh
npm ci
npm test
npm run demo:orm -- raw
npm run demo:orm -- orm
npm run demo:orm -- sql
```

The ORM batch uses Drizzle with `better-sqlite3`; the raw batch keeps Node's
built-in driver. Read `src/orm/`. `sql` prints generated statements and parameters.
See the [ORM walkthrough](../../docs/orms.md).

The native driver is pinned to 12.11.1, verified on Node 22.10; 13.0.3 crashed
on that local toolchain. npm's package-specific `allowScripts` entry permits its
native installation. A C++ build toolchain may be needed if a prebuilt binary
isn't available. `skipLibCheck` avoids errors in Drizzle's external declarations
for optional drivers; application and test code still use strict type checking.

## Unit of Work

```sh
npm run demo:uow
```

Runs three checked scenarios: partial saves before adding a transaction, rollback
after a missing order, and a successful two-order commit. Uses the existing ORM
dependencies. See the [shared walkthrough](../../docs/unit-of-work.md) for
transaction ownership, flush versus commit, and implementation links.
