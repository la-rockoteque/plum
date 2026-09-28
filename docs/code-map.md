# code-map (strongly recommended)

[code-map](ssh://git@git.nexapptech.com/internal/code-map.git) indexes a repository into a structural graph
(tree-sitter → FalkorDB). With it, `/plum:teach` binds concepts to *facts* instead of file-name guesses — which
files import an ORM, which classes implement a repository interface, who calls it — and outlines come straight
from the graph, which is cheaper than reading files.

## Install

```sh
CARGO_NET_GIT_FETCH_WITH_CLI=true \
  cargo install --git ssh://git@git.nexapptech.com/internal/code-map.git --locked code-map
pip install --user falkordblite
export CODE_MAP_FALKOR_BIN="$(python3 -c 'import os,redislite;print(os.path.join(os.path.dirname(redislite.__file__),"bin","redis-server"))')"
```

Requires Rust 1.85+ and Python 3.12+. Add the `export` to your shell profile.

## Index a repository

```sh
plugin/bin/plum teach index      # from inside the repo; or: code-map index . --name <name>
```

The graph lives in code-map's own store — nothing is written into the repository. Re-running is incremental.
The graph name is the project's `label` in `.code-map/projects.json` if the repo has one, otherwise the directory name.

## Make it optional or mandatory

```json
{ "teach": { "codeMap": "auto" } }
```

| Value | Behaviour |
|---|---|
| `auto` (default) | Use code-map when it's installed and the repo is indexed. Otherwise fall back to file-name heuristics and print a recommendation (install it, or run `plum teach index`). |
| `required` | Refuse to survey without code-map (with install instructions); index the repo automatically if it isn't yet. |
| `off` | Never call code-map. |

A team can set `required` in the committed `<project>/.plum/config.json` so every lecture on that repo uses the graph.
