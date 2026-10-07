import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export function registerDraftStash(pi: ExtensionAPI) {
  let stash: { text: string; cursor?: { line: number; col: number } } | undefined;
  let editor: CustomEditor | undefined;
  let editorFactory: ReturnType<ExtensionContext["ui"]["getEditorComponent"]>;

  pi.on("session_start", (event, ctx) => {
    if (event.reason !== "reload") stash = undefined;
    editor = undefined;
    editorFactory = undefined;
    if (ctx.mode !== "tui" || ctx.ui.getEditorComponent() || ctx.ui.getEditorText()) return;

    editorFactory = (tui, theme, keybindings) =>
      (editor = new CustomEditor(tui, theme, keybindings, { embedWorkingStatus: true }));
    ctx.ui.setEditorComponent(editorFactory);
    if (event.reason === "reload") {
      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type !== "message" || entry.message.role !== "user") continue;
        const content = entry.message.content;
        const text = typeof content === "string" ? content :
          content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n");
        if (text) editor?.addToHistory(text);
      }
    }
  });

  pi.registerShortcut("ctrl+s", {
    description: "Stash or restore prompt draft",
    handler: (ctx) => {
      if (ctx.mode !== "tui") return;
      const text = ctx.ui.getEditorText();
      if (text && stash) return ctx.ui.notify("Restore the stashed draft before stashing another", "warning");
      const activeEditor = editor && editorFactory === ctx.ui.getEditorComponent() ? editor : undefined;
      if (text) {
        stash = { text, cursor: activeEditor?.getText() === text ? activeEditor.getCursor() : undefined };
        ctx.ui.setEditorText("");
        ctx.ui.notify("Draft stashed (Ctrl+S to restore)", "info");
      } else if (stash) {
        ctx.ui.setEditorText(stash.text);
        if (activeEditor && stash.cursor) {
          const target = stash.cursor;
          // ponytail: replaying cursor moves scales with draft length; use a public cursor setter if Pi adds one.
          for (let i = 0; i < stash.text.length; i++) {
            const cursor = activeEditor.getCursor();
            if (cursor.line < target.line || (cursor.line === target.line && cursor.col <= target.col)) break;
            activeEditor.handleInput("\u001b[D");
          }
        } else {
          ctx.ui.notify("Cursor restore unavailable with pasted content or another editor", "warning");
        }
        stash = undefined;
      }
    },
  });
}
