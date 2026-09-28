# Leapsome connector — instructions for Claude

Plum prepares the payload; you send it with **the user's own Leapsome MCP tools**. Plum never talks to Leapsome.

## Find the tools

Look for tools whose name matches `mcp__…leapsome…` (case-insensitive) and whose descriptions mention goals —
creating a personal goal, updating a goal's progress or status, commenting on a goal. If the only Leapsome tool is
`authenticate`, the user hasn't signed in: ask them to run it (or connect Leapsome in Claude), then retry. If there
are no Leapsome tools at all, say that Leapsome's MCP isn't connected and stop — never fall back to the web or API.

## goals.create

1. `plum connectors payload leapsome goals.create <proposalId>` prints the exact fields and the visibility warning.
2. Show the user the fields **and the visibility line** and ask to confirm (AskUserQuestion: "Create it in
   Leapsome", "Edit first", "Don't"). Only after confirmation call the create-personal-goal tool with `title`,
   `description` and the due date; set it as a personal goal owned by the user. Leapsome shows its own confirmation
   step — tell the user to approve it there.
3. Take the id of the created goal from the tool's result and run
   `plum connectors link leapsome <proposalId> <goalId>`. If no id is returned, tell the user the goal was created
   but can't be synced, and don't link.

## goals.progress

1. `plum connectors payload leapsome goals.progress` prints one update per linked goal: `externalId`,
   `progressPercent`, `comment`.
2. Show the updates and ask once to confirm all of them (or pick). Then, per goal, update its progress to
   `progressPercent` and add `comment` as a goal comment (`goals.comment`) if the tool supports comments.
3. Report what was updated. Never sync without being asked; suggest it at most weekly.

## Never

- Send anything the payload command didn't print — no code, file paths, repository, product or people's names.
- Create goals for other people, or change a goal's visibility unless the user asks.
