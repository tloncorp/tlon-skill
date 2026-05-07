import type { Story, StoryBlock, StoryInline, StoryVerse } from "./story";

const UNSUPPORTED_CONTENT_ERROR = "Unsupported notebook content JSON: expected a Story array";

function isPlainObject(value: any): value is Record<string, any> {
  if (!value || typeof value !== "object") return false;
  return !Array.isArray(value);
}

function hasOnlyKey(value: Record<string, any>, key: string): boolean {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === key;
}

function isStoryInline(value: any): value is StoryInline {
  if (typeof value === "string") return true;
  if (!isPlainObject(value)) return false;

  if (hasOnlyKey(value, "bold")) return isStoryInlineArray(value.bold);
  if (hasOnlyKey(value, "italics")) return isStoryInlineArray(value.italics);
  if (hasOnlyKey(value, "strike")) return isStoryInlineArray(value.strike);
  if (hasOnlyKey(value, "blockquote")) return isStoryInlineArray(value.blockquote);
  if (hasOnlyKey(value, "inline-code")) return typeof value["inline-code"] === "string";
  if (hasOnlyKey(value, "code")) return typeof value.code === "string";
  if (hasOnlyKey(value, "ship")) return typeof value.ship === "string";
  if (hasOnlyKey(value, "tag")) return typeof value.tag === "string";
  if (hasOnlyKey(value, "break")) return value.break === null;
  if (hasOnlyKey(value, "link")) {
    return (
      isPlainObject(value.link) &&
      typeof value.link.href === "string" &&
      typeof value.link.content === "string"
    );
  }

  return false;
}

function isStoryInlineArray(value: any): value is StoryInline[] {
  return Array.isArray(value) && value.every(isStoryInline);
}

function isHeaderBlock(value: any): boolean {
  return (
    isPlainObject(value) &&
    ["h1", "h2", "h3", "h4", "h5", "h6"].includes(value.tag) &&
    isStoryInlineArray(value.content)
  );
}

function isCodeBlock(value: any): boolean {
  return isPlainObject(value) && typeof value.code === "string" && typeof value.lang === "string";
}

function isImageBlock(value: any): boolean {
  return (
    isPlainObject(value) &&
    typeof value.src === "string" &&
    typeof value.height === "number" &&
    typeof value.width === "number" &&
    typeof value.alt === "string"
  );
}

function isStoryBlock(value: any): value is StoryBlock {
  if (!isPlainObject(value)) return false;

  if (hasOnlyKey(value, "header")) return isHeaderBlock(value.header);
  if (hasOnlyKey(value, "code")) return isCodeBlock(value.code);
  if (hasOnlyKey(value, "image")) return isImageBlock(value.image);
  if (hasOnlyKey(value, "rule")) return value.rule === null;

  return false;
}

function isStoryVerse(value: any): value is StoryVerse {
  if (!isPlainObject(value)) return false;

  if (hasOnlyKey(value, "inline")) return isStoryInlineArray(value.inline);
  if (hasOnlyKey(value, "block")) return isStoryBlock(value.block);

  return false;
}

function isStory(value: any): value is Story {
  return Array.isArray(value) && value.every(isStoryVerse);
}

export function normalizeNotebookContent(raw: any): Story {
  if (isStory(raw)) return raw;
  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}
