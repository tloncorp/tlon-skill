import type { Story } from "./story";

const UNSUPPORTED_CONTENT_ERROR = "Unsupported notebook content JSON: expected a Story array";

export function normalizeNotebookContent(raw: any): Story {
  if (Array.isArray(raw)) return raw as Story;
  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}
