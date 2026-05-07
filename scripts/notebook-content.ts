import type { Story } from "./story";

const UNSUPPORTED_CONTENT_ERROR = "Unsupported notebook content JSON: expected a Story array";

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStoryVerseEnvelope(value: any): boolean {
  if (!isPlainObject(value)) return false;

  const keys = Object.keys(value);
  if (keys.length !== 1) return false;

  if (keys[0] === "inline") return Array.isArray(value.inline);
  if (keys[0] === "block") {
    return isPlainObject(value.block) && Object.keys(value.block).length === 1;
  }
  return false;
}

export function normalizeNotebookContent(raw: any): Story {
  if (Array.isArray(raw) && raw.every(isStoryVerseEnvelope)) return raw as Story;
  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}
