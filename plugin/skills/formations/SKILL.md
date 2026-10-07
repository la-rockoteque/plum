---
name: formations
description: Find a hands-on formation (a guided course with a coach, modules and a starter project), set it up, and start it in this session. Use when the user asks for a formation, a course, hands-on practice on a concept, or follows up on a formation that /plum:teach offered.
argument-hint: "[concept id | formation id]"
---

```bash
P="${CLAUDE_PLUGIN_ROOT}/bin/plum"
```

## 1. Find it

- `$ARGUMENTS` is a formation id from `"$P" formations list` → use it.
- `$ARGUMENTS` is a concept → `"$P" formations match "$ARGUMENTS"`. Concept ids are English; translate the keywords if needed.
- Nothing, or no match → `"$P" formations list`, and show each formation with the concepts its modules cover.

Ask which formation to take, and which language if it lists several (AskUserQuestion). Don't invent formations.

## 2. Set it up

The folder is `F="$HOME/formations/<formation>"`. It sits outside the user's repo, so it doesn't nest a git repo in
their project, and the learner's progress in `learner/` survives between sessions.

- If `$F/.claude/skills/start/SKILL.md` exists, the formation is already there. Reuse it. Never delete it: it holds
  the learner's progress.
- Otherwise, run `"$P" formations fetch <formation> --lang <lang> --dir "$F"`. Drop `--lang` if the formation has a
  single starter.

## 3. Start it

Ask where to run it (AskUserQuestion):

- **Here, in this session (Recommended).** Follow the guest mode below.
- **In a new session.** This applies the formation's own permissions and settings. Give these commands, one per line:
  `cd "<F>"`, `claude`, `/start`. Then stop.

### Guest mode

Run the formation as if this session had been opened in `$F`:

1. Read `$F/CLAUDE.md`, then `$F/.claude/skills/start/SKILL.md`, and follow them. They take over from Plum for the
   formation work, including the language and tone they ask for.
2. Every relative path in them points into `$F`: `learner/profile.json` is `$F/learner/profile.json`. Use absolute
   paths with Read, Write, Edit, Glob and Grep. Start each Bash command with `cd "$F" &&`, because the shell
   directory can reset between calls.
3. When they say to run a skill (`/assess`, `/plan`, `/teach`, `/progress`, `/review`…), don't call a slash command.
   Read `$F/.claude/skills/<name>/SKILL.md` and follow it. The formation's `/teach` is not `/plum:teach`.
4. Don't write outside `$F` while in guest mode. Never look for or show anything from a `solutions/` folder.
5. The formation's `.claude/settings.json` doesn't apply here, so the user can see more permission prompts than in a
   new session. Say so once, at the start.

Guest mode ends when the user says so or goes back to their own work. To continue later, run `/plum:formations
<formation>` again: step 2 reuses the folder and `/start` greets a returning learner.
