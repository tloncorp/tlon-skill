import { markdownToStory, type Story } from "./story";

function isStoryVerse(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if ("inline" in value && Array.isArray(value.inline)) return true;
  if ("block" in value && value.block && typeof value.block === "object") return true;
  return false;
}

function isStory(value: any): value is Story {
  return Array.isArray(value) && value.every(isStoryVerse);
}

function extractRichText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractRichText).join("");
  if (typeof node !== "object") return "";

  if (typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";

  const children = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.content)
      ? node.content
      : [];

  return children.map(extractRichText).join("");
}

function richJsonToMarkdown(input: any): string {
  const nodes = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray(input.content)
      ? input.content
      : [];

  if (!Array.isArray(nodes) || nodes.length === 0) return "";

  const blocks: string[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const type = typeof node.type === "string" ? node.type : "";
    const text = extractRichText(node).trim();
    if (!text) continue;

    if (type === "header" || type === "heading") {
      const levelRaw = Number(node.level ?? node.attrs?.level ?? 1);
      const level = Number.isFinite(levelRaw) ? Math.min(6, Math.max(1, levelRaw)) : 1;
      blocks.push(`${"#".repeat(level)} ${text}`);
      continue;
    }

    blocks.push(text);
  }

  return blocks.join("\n\n");
}

export function normalizeNotebookContent(raw: any): Story {
  if (isStory(raw)) return raw;

  const markdown = richJsonToMarkdown(raw);
  if (markdown.trim().length > 0) {
    const story = markdownToStory(markdown);
    if (story.length > 0) return story;
  }

  throw new Error(
    "Unsupported notebook content JSON: expected a Story array or recognized rich-text content"
  );
}
