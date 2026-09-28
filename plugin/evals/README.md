# Plum evals

`claude plugin eval` cases for the plugin's skills. Each run is a real Claude session on your credentials, so the
suite is small and `runs: 1` by default. Cases tagged `cheap` take a few turns; `teach-deck` runs a whole lecture.

```sh
cd plugin
claude plugin eval . --tag cheap --allow-tools Bash --no-publish            # quick check
claude plugin eval . --case teach-deck --scaffold --allow-tools Bash Write --no-publish
```

- Plum's data is isolated per run with `EVAL_PLUM_DATA_DIR` (relative to the eval workspace), so evals never touch
  your real `~/.plum`.
- `--scaffold` is needed for `teach-deck` (it creates a tiny TypeScript repo); only pass it for this suite.
- The default ablation also runs each case without the plugin; `with-only` graders check the plugin's own helpers fired.
