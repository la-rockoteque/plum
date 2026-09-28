# Sending feedback

Plum sends nothing on its own. Feedback goes through a Google Form that **you** submit: Plum builds a link with
the text already filled in, you read it in the browser, and you click Submit — or close the tab.

## From Claude Code

```text
/plum:feedback the deck's arrow keys skip a slide on Firefox
```

Claude drafts the text, removes anything sensitive (code, paths, repository, product, customer or people's
names, secrets), shows you the exact text and asks whether to open the form, drop the context line, edit it, or
not send it. Only then does it open the browser.

Claude also offers this when you ask Plum for something it can't do, so the request reaches the author as a
feature request — again only after you say yes.

## From the terminal

```sh
plugin/bin/plum feedback --kind feature --message "Teach Rust concepts" --why "our backend is Rust"
plugin/bin/plum feedback --kind bug --message "…" --open        # also opens the browser
echo "long text" | plugin/bin/plum feedback --kind feedback      # message from stdin
```

| Flag | Meaning |
|---|---|
| `--kind feature\|bug\|feedback` | Label at the top of the text (default `feedback`) |
| `--message` | Summary line, then optional details on the following lines (or pipe it on stdin) |
| `--why` | The use case behind a request |
| `--contact` | Only if you want a reply |
| `--no-context` | Leave out the context line |
| `--open` | Open the link in your browser; without it, the command only prints |

The command prints the form's host, the exact text and the link. The text is capped at 5,000 characters; if the
link would exceed about 7,000 characters, it prints the form URL and the text to paste instead.

The context line looks like `Plum 0.2.0, mode=coach, statistics=off, Bun 1.3.5, darwin-arm64` — versions and
settings only.

## Point it at your team's form, or turn it off

Put this in the project's committed `.plum/config.json` (applies to everyone on the repo) or in your own
`~/.plum/config.json`:

```json
{ "feedback": { "formUrl": "https://docs.google.com/forms/d/e/<id>/viewform", "entryId": "entry.123456789" } }
```

`formUrl` must be `https`. `entryId` is the paragraph field that receives the text; get it from the form's
**⋮ → Get pre-filled link** menu (fill the field, copy the link, and read the `entry.<digits>` parameter).

To turn feedback off: `{ "feedback": { "enabled": false } }`.
