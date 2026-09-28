---
type: llm
weight: 2
---
PASS if the response presents a rendered lecture deck (a path to an .html file) and binds the repository pattern's
roles to this repo's real code — OrderService in src/orders/order.service.ts as the use case with SQL inside it,
and a repository port it lacks (reported as missing, not invented as if it existed).
FAIL if it claims code exists that the repo doesn't have, skips rendering, or publishes the deck somewhere.
