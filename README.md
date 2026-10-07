# Pi QoL extension

A few small conveniences for the [earendil-works Pi coding agent](https://github.com/earendil-works/pi): undo an early abort, stash a draft, and search your prompt history.

## Install

You need Pi with extension support. Install the package from GitHub:

```sh
pi install git:github.com/tomstiani/pi-qol-extension
```

Start Pi (or run `/reload` if it is already open). If you have also copied this extension into your Pi extensions directory, remove that copy to avoid loading it twice.

## Use

| Action | What it does |
| --- | --- |
| **Esc** within one second of submitting a prompt | If the response aborts before any tool starts, rewind the turn and restore the prompt. The removed branch remains accessible via `/tree`. |
| **Ctrl+S** | Stash the current draft; press again in an empty editor to restore it. One draft can be stashed at a time. |
| **Ctrl+R** or `/qol-history` | Fuzzy-search your prompts in the current session. Selecting one replaces the editor text, with confirmation if you have a draft. |

These shortcuts work in Pi's interactive terminal UI. Draft stashing preserves the cursor position when Pi's custom editor is active; drafts do not persist across sessions.

## Test

If you have [Bun](https://bun.sh/) installed, run:

```sh
bun install
bun test
```

Test dependencies are local to this repository. The extension uses Pi's host-provided packages at runtime.
