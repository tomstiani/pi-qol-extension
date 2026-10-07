import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { fuzzyFilter } from "@earendil-works/pi-tui";

export function registerHistorySearch(pi: ExtensionAPI) {
  async function search(ctx: ExtensionContext) {
    if (ctx.mode !== "tui") return;
    const query = await ctx.ui.input("Search prompts in this session", "Search text");
    if (query === undefined) return;
    const prompts = [...new Set(ctx.sessionManager.getBranch()
      .filter((entry) => entry.type === "message" && entry.message.role === "user")
      .map((entry) => typeof entry.message.content === "string" ? entry.message.content :
        entry.message.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n"))
      .filter(Boolean)
      .reverse())];
    const matches = fuzzyFilter(prompts, query, (text) => text);
    if (!matches.length) return ctx.ui.notify("No matching prompts", "info");
    const labels = matches.map((text, index) => `${index + 1}. ${text.replace(/\s+/g, " ").slice(0, 120)}`);
    const selected = await ctx.ui.select("Prompt history", labels);
    if (selected !== undefined && (!ctx.ui.getEditorText() ||
        await ctx.ui.confirm("Replace draft?", "This will replace the current editor text."))) {
      ctx.ui.setEditorText(matches[labels.indexOf(selected)]);
    }
  }

  pi.registerShortcut("ctrl+r", { description: "Search prompts in this session", handler: search });
  pi.registerCommand("qol-history", { description: "Search prompts in this session", handler: async (_args, ctx) => search(ctx) });
}
