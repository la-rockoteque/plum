# Updates

Plum is versioned by commit: every push to `main` is a new version.

## On session start

A `SessionStart` hook compares your installed commit with the marketplace's `main` (a `git ls-remote` over your
existing git credentials, 3-second timeout, at most every `updates.checkIntervalHours`) and then acts on
`updates.mode`:

| Mode | What happens |
|---|---|
| `prompt` (default) | You see "Plum update available (abc1234 → def5678)", and Claude asks you on its first reply whether to update. It updates only if you say yes. |
| `silent` | Plum updates in the background and tells you it did. The new version is active after `/reload-plugins` or in the next session. |
| `off` | No check. |

```json
// ~/.plum/config.json  or  <project>/.plum/config.local.json
{ "updates": { "mode": "silent", "checkIntervalHours": 12 } }
```

`silent` runs new code without asking, so only your personal or local config can enable it — a committed project
config asking for `silent` is treated as `prompt`. A committed `{ "updates": { "mode": "off" } }` turns checks off
for everyone. `DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` disable the check too (unless `FORCE_AUTOUPDATE_PLUGINS`).

A failed or offline check never blocks startup; it's retried next time. When Plum runs from a repo checkout
(`claude --plugin-dir`), it never checks.

## By hand

```sh
plugin/bin/plum update           # check now
plugin/bin/plum update --apply   # check and install (claude plugin marketplace update + claude plugin update)
```

## Claude Code's own auto-update

Claude Code can also refresh the marketplace itself: `/plugin` → **Marketplaces** → `plum` → **Enable auto-update**.
It runs a few minutes after your first message rather than at startup; both can be on together.
