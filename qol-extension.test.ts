import { test, expect, mock } from "bun:test";
import { CustomEditor } from "@earendil-works/pi-coding-agent";
import * as tui from "@earendil-works/pi-tui";
mock.module("@earendil-works/pi-tui", () => tui);
mock.module("@earendil-works/pi-coding-agent", () => ({ CustomEditor }));
const { default: qolExtension } = await import("./index.ts");

test("quick abort rewinds the conversation; later aborts and tool runs do not", async () => {
  const handlers: Record<string, Function[]> = {};
  const emit = (name: string, event: object, ctx: unknown) => {
    for (const handler of handlers[name] ?? []) handler(event, ctx);
  };
  const shortcuts: Record<string, Function> = {};
  const commands: Record<string, Function> = {};
  let terminalInput: (data: string) => void = () => {};
  let editor = "";
  let activeEditor: InstanceType<typeof CustomEditor> | undefined;
  let editorFactory: Function | undefined;
  let now = 10_000;
  const dateNow = Date.now;
  Date.now = () => now;
  const entries: any[] = [];
  const user = { id: "u", type: "message", message: { role: "user", timestamp: 1, content: [{ type: "text", text: "old prompt" }] } };
  const assistant = { id: "a", type: "message", message: { role: "assistant", timestamp: 2, stopReason: "aborted", content: [] } };
  const dispatched: string[] = [];
  const ctx: any = {
    mode: "tui", isIdle: () => false,
    sessionManager: { getBranch: () => entries },
    ui: {
      onTerminalInput: (fn: typeof terminalInput) => { terminalInput = fn; },
      notify: () => {}, getEditorText: () => editor,
      setEditorText: (text: string) => { editor = text; activeEditor?.setText(text); },
      getEditorComponent: () => editorFactory,
      setEditorComponent: (factory?: Function) => {
        editorFactory = factory;
        activeEditor = factory?.({ requestRender: () => {} }, { borderColor: (text: string) => text }, { matches: () => false });
      },
      input: async () => "ol prm", select: async (_title: string, values: string[]) => values[0], confirm: async () => true,
    },
    navigateTree: async (id: string) => {
      expect(id).toBe("u");
      entries.length = 0;
      ctx.ui.setEditorText("old prompt");
      emit("session_tree", {}, ctx);
      return { cancelled: false };
    },
  };
  const pi: any = {
    on: (name: string, handler: Function) => { (handlers[name] ??= []).push(handler); },
    sendUserMessage: (text: string) => { dispatched.push(text); },
    registerShortcut: (key: string, options: { handler: Function }) => { shortcuts[key] = options.handler; },
    registerCommand: (name: string, options: { handler: Function }) => { commands[name] = options.handler; },
  };
  try {
    qolExtension(pi);
    emit("session_start", {}, ctx);
    entries.push(user, assistant);
    emit("input", { source: "interactive", text: "old prompt" }, ctx);
    now += 100;
    terminalInput("\u001b[27u");
    emit("agent_end", {}, ctx);
    emit("agent_settled", {}, ctx);
    expect(dispatched).toEqual(["/qol-rewind"]);
    await commands["qol-rewind"]("", ctx);
    expect(entries).toEqual([]);
    expect(editor).toBe("");

    entries.push(user, assistant);
    emit("input", { source: "interactive", text: "old prompt" }, ctx);
    now += 1001;
    terminalInput("\u001b");
    emit("agent_end", {}, ctx);
    emit("agent_settled", {}, ctx);
    expect(dispatched).toHaveLength(1);
    emit("input", { source: "interactive", text: "old prompt" }, ctx);
    emit("tool_execution_start", {}, ctx);
    terminalInput("\u001b");
    emit("agent_end", {}, ctx);
    emit("agent_settled", {}, ctx);
    expect(dispatched).toHaveLength(1);

    ctx.ui.setEditorText("draft");
    activeEditor?.handleInput("\u001b[D");
    activeEditor?.handleInput("\u001b[D");
    await shortcuts["ctrl+s"](ctx);
    expect(editor).toBe("");
    await shortcuts["ctrl+s"](ctx);
    expect(editor).toBe("draft");
    expect(activeEditor?.getCursor().col).toBe(3);
    await shortcuts["ctrl+r"](ctx);
    expect(editor).toBe("old prompt");

    ctx.ui.setEditorText("first\nsecond");
    for (let i = 0; i < 8; i++) activeEditor?.handleInput("\u001b[D");
    const cursor = activeEditor?.getCursor();
    await shortcuts["ctrl+s"](ctx);
    await shortcuts["ctrl+s"](ctx);
    expect(activeEditor?.getCursor()).toEqual(cursor);

    ctx.ui.setEditorComponent(undefined);
    ctx.ui.setEditorText("");
    emit("session_start", { reason: "reload" }, ctx);
    activeEditor?.handleInput("\u001b[A");
    expect(activeEditor?.getText()).toBe("old prompt");

    ctx.ui.setEditorText("stash across reload");
    await shortcuts["ctrl+s"](ctx);
    ctx.ui.setEditorComponent(undefined);
    emit("session_start", { reason: "reload" }, ctx);
    await shortcuts["ctrl+s"](ctx);
    expect(editor).toBe("stash across reload");
  } finally {
    Date.now = dateNow;
  }
});
