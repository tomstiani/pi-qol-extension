import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

const UNDO_WINDOW_MS = 1000;
type HiddenTurn = { user: number; assistant: number };

export function registerQuickAbort(pi: ExtensionAPI) {
  let submittedAt = 0;
  let quickAbort = false;
  let toolStarted = false;
  let pending: { userId: string; assistantId: string } | undefined;
  let hidden: HiddenTurn[] = [];

  const restoreHidden = (ctx: ExtensionContext) => {
    hidden = ctx.sessionManager.getBranch()
      .filter((entry) => entry.type === "custom" && entry.customType === "qol-hidden-turn")
      .map((entry) => entry.data as HiddenTurn);
  };

  pi.on("session_start", (_event, ctx) => {
    submittedAt = 0;
    quickAbort = false;
    toolStarted = false;
    pending = undefined;
    restoreHidden(ctx);

    if (ctx.mode === "tui") {
      ctx.ui.onTerminalInput((data) => {
        if (matchesKey(data, "escape") && submittedAt && Date.now() - submittedAt < UNDO_WINDOW_MS && !toolStarted && !ctx.isIdle()) {
          quickAbort = true;
        }
      });
    }
  });

  pi.on("session_tree", (_event, ctx) => {
    pending = undefined;
    restoreHidden(ctx);
  });

  pi.on("input", (event) => {
    if (event.source !== "interactive" || event.streamingBehavior) return;
    submittedAt = Date.now();
    quickAbort = false;
    toolStarted = false;
  });

  pi.on("tool_execution_start", () => { toolStarted = true; });

  pi.on("agent_end", (_event, ctx) => {
    const branch = ctx.sessionManager.getBranch();
    const messages = branch.filter((entry) => entry.type === "message");
    const assistant = messages.at(-1);
    const user = messages.findLast((entry) => entry.message.role === "user");
    if (ctx.mode === "tui" && quickAbort && !toolStarted && assistant?.message.role === "assistant" &&
        assistant.message.stopReason === "aborted" && user?.message.role === "user") {
      pending = { userId: user.id, assistantId: assistant.id };
    }
    submittedAt = 0;
    quickAbort = false;
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (pending && ctx.sessionManager.getBranch().findLast((entry) => entry.type === "message")?.id === pending.assistantId) {
      // Dispatch after settlement: tree navigation cannot run inside a lifecycle handler.
      pi.sendUserMessage("/qol-rewind", { expandPromptTemplates: true });
    } else {
      pending = undefined;
    }
  });

  pi.registerCommand("qol-rewind", {
    description: "Return to the prompt aborted within one second",
    handler: async (_args, ctx) => {
      const target = pending;
      pending = undefined;
      if (!target || ctx.sessionManager.getBranch().findLast((entry) => entry.type === "message")?.id !== target.assistantId) return;
      const hadDraft = !!ctx.ui.getEditorText();
      const result = await ctx.navigateTree(target.userId, { summarize: false });
      if (!result.cancelled) {
        if (!hadDraft) ctx.ui.setEditorText("");
        ctx.ui.notify("Early abort: turn removed from conversation (recoverable in /tree)", "info");
      }
    },
  });

  // Keep earlier hidden turns excluded in sessions created by the previous version.
  pi.on("context", (event) => ({
    messages: event.messages.filter((message) => !hidden.some((turn) =>
      (message.role === "user" && message.timestamp === turn.user) ||
      (message.role === "assistant" && message.timestamp === turn.assistant))),
  }));
}
