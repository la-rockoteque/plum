# Streamed examples and the library cache

The installed plugin carries the concept manifests and narratives, so `plum concepts` and `/plum:teach` can pick a
concept instantly. The example **code** is not installed: when a lecture needs it, Plum fetches only that
concept's files in one language.

```sh
plugin/bin/plum library fetch unit-of-work --lang kotlin   # prints the local directory and the files
```

The fetch is a blobless, depth-1, sparse `git fetch` of the exact commit you have installed, over the same git
access you used to add the marketplace — typically a few KB per concept and language. Files land in
`~/.plum/library-cache/<concept>/<language>/`.

## Garbage collection

Before every fetch (and on `plugin/bin/plum library gc`), Plum removes:

1. files from a different Plum version than the one installed,
2. entries not used for `library.cacheTtlDays` (default 30),
3. the least recently used entries while the cache is above `library.cacheMaxMb` (default 25).

Concepts you've fetched `library.keepAfterUses` times (default 3), or pinned by hand, are **kept** through 2 and 3.
Usage counts survive eviction, so a concept you use often is kept again as soon as it's back.

```sh
plugin/bin/plum library status              # what's cached, sizes, uses, kept / cached / evicted
plugin/bin/plum library keep cqrs           # never collect cqrs (any language)
plugin/bin/plum library unkeep cqrs
plugin/bin/plum library clear               # delete the whole cache
```

## From a checkout

When Plum runs from its repository (`claude --plugin-dir`), `library/examples` is read in place and nothing is
fetched.

## Configuration

```json
{ "library": { "cacheMaxMb": 25, "cacheTtlDays": 30, "keepAfterUses": 3, "repoUrl": "git@host:team/plum.git" } }
```

`repoUrl` defaults to the marketplace's git URL; set it only for a mirror, and only in your personal or local
config — a committed project config can't redirect where code comes from. URLs must be `https://`, `ssh://`,
`git@…` or an absolute local path.

## Safety

Manifests are repository content, so Plum treats them as untrusted: concept ids, languages and file paths must be
plain relative paths, git gets `--end-of-options` before any ref, and only regular files (no symlinks, no
submodules) inside the example project are copied into the cache.
