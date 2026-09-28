# Infra examples

Deployment-medium concepts — Dockerfiles, CI pipelines, Terraform — for operating the order service from the
backend examples. Code-level infra concepts (config, health checks, circuit breakers, …) live in the five
language projects instead.

Each concept is a directory `<id>/` with one sub-directory per stage and a `check.sh` that proves the lesson and
exits non-zero on failure.

```sh
./check-all.sh          # every concept
./<concept>/check.sh    # one concept
```

Requirements: Docker (daemon running) and Terraform ≥ 1.6. Checks never contact a cloud account: Terraform runs
`init`/`validate`/`plan` against local or null providers only, and nothing calls `apply`.
