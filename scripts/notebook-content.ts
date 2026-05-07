import type { Story } from "./story";

const UNSUPPORTED_CONTENT_ERROR = "Unsupported notebook content JSON: expected a Story array";

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isStoryVerseEnvelope(value: any): boolean {
  if (!isPlainObject(value)) return false;

  const hasInline = hasOwn(value, "inline");
  const hasBlock = hasOwn(value, "block");
  if (hasInline === hasBlock) return false;

  if (hasInline) return Array.isArray(value.inline);
  return isPlainObject(value.block) && Object.keys(value.block).length === 1;
}

export function normalizeNotebookContent(raw: any): Story {
  if (Array.isArray(raw) && raw.every(isStoryVerseEnvelope)) return raw as Story;
  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}
