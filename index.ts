import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerQuickAbort } from "./quick-abort.ts";
import { registerDraftStash } from "./draft-stash.ts";
import { registerHistorySearch } from "./history-search.ts";

export default function qolExtension(pi: ExtensionAPI) {
  registerQuickAbort(pi);
  registerDraftStash(pi);
  registerHistorySearch(pi);
}
