import type { Story, StoryBlock, StoryInline, StoryVerse } from "./story";

const UNSUPPORTED_CONTENT_ERROR =
  "Unsupported notebook content JSON: expected a Story array or recognized rich-text content";
type StoryHeaderTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

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

function extractRichText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractRichText).join("");
  if (typeof node !== "object") return "";

  if (typeof node.text === "string") return node.text;
  if (normalizedNodeType(node) === "hardbreak") return "\n";

  const children = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.content)
      ? node.content
      : [];

  return children.map(extractRichText).join("");
}

function richChildren(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node.children)) return node.children;
  if (Array.isArray(node.content)) return node.content;
  return [];
}

function mergeAdjacentStrings(inlines: StoryInline[]): StoryInline[] {
  const result: StoryInline[] = [];
  for (const inline of inlines) {
    if (typeof inline === "string" && typeof result[result.length - 1] === "string") {
      result[result.length - 1] = (result[result.length - 1] as string) + inline;
    } else {
      result.push(inline);
    }
  }
  return result;
}

function normalizedMarkType(mark: any): string {
  if (!isPlainObject(mark) || typeof mark.type !== "string") return "";
  return mark.type.toLowerCase().replace(/[-_]/g, "");
}

function normalizedNodeType(node: any): string {
  if (!isPlainObject(node) || typeof node.type !== "string") return "";
  return node.type.toLowerCase().replace(/[-_]/g, "");
}

function isRichParagraphType(type: string): boolean {
  return type === "paragraph" || type === "p";
}

function richHeadingTag(node: Record<string, any>): StoryHeaderTag {
  const levelRaw = node.level ?? node.attrs?.level ?? 1;
  const level = Number(levelRaw);
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error(UNSUPPORTED_CONTENT_ERROR);
  }
  return `h${level}` as StoryHeaderTag;
}

function isSupportedRichNodeType(type: string): boolean {
  return (
    isRichParagraphType(type) ||
    type === "header" ||
    type === "heading" ||
    type === "codeblock" ||
    type === "blockquote" ||
    type === "horizontalrule" ||
    type === "rule" ||
    type === "hr"
  );
}

function hasRichChildrenKey(node: Record<string, any>): boolean {
  return "children" in node || "content" in node;
}

function validateRichChildrenShape(node: Record<string, any>): void {
  if ("children" in node && "content" in node) {
    throw new Error(UNSUPPORTED_CONTENT_ERROR);
  }
  if ("children" in node && !Array.isArray(node.children)) {
    throw new Error(UNSUPPORTED_CONTENT_ERROR);
  }
  if ("content" in node && !Array.isArray(node.content)) {
    throw new Error(UNSUPPORTED_CONTENT_ERROR);
  }
}

function isSupportedRichMarkType(type: string): boolean {
  return [
    "bold",
    "strong",
    "italic",
    "italics",
    "em",
    "strike",
    "strikethrough",
    "s",
    "code",
    "inlinecode",
    "link",
  ].includes(type);
}

function validateRichMarks(marks: any): void {
  if (marks == null) return;
  if (!Array.isArray(marks)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

  let linkCount = 0;
  let hasCode = false;
  for (const mark of marks) {
    if (!isPlainObject(mark)) throw new Error(UNSUPPORTED_CONTENT_ERROR);
    const type = normalizedMarkType(mark);
    if (!isSupportedRichMarkType(type)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

    if (type === "link") {
      linkCount++;
      if (
        !isPlainObject(mark.attrs) ||
        (typeof mark.attrs.href !== "string" && typeof mark.attrs.url !== "string")
      ) {
        throw new Error(UNSUPPORTED_CONTENT_ERROR);
      }
    }
    if (type === "code" || type === "inlinecode") {
      hasCode = true;
    }
  }

  if (linkCount > 1 || (linkCount > 0 && hasCode)) {
    throw new Error(UNSUPPORTED_CONTENT_ERROR);
  }
}

function isRichTextNode(node: any): boolean {
  return isPlainObject(node) && typeof node.text === "string";
}

function validateRichInlineNode(node: any): void {
  if (typeof node === "string") return;
  if (!isPlainObject(node)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

  const type = normalizedNodeType(node);
  if (isRichTextNode(node)) {
    if (type && type !== "text") throw new Error(UNSUPPORTED_CONTENT_ERROR);
    if (hasRichChildrenKey(node)) throw new Error(UNSUPPORTED_CONTENT_ERROR);
    validateRichMarks(node.marks);
    return;
  }

  if (type === "hardbreak") {
    validateRichChildrenShape(node);
    return;
  }

  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}

function validateRichInlineChildren(node: Record<string, any>): void {
  validateRichChildrenShape(node);
  for (const child of richChildren(node)) {
    validateRichInlineNode(child);
  }
}

function validateRichCodeBlock(node: Record<string, any>): void {
  validateRichChildrenShape(node);
  for (const child of richChildren(node)) {
    if (typeof child === "string") continue;
    if (!isPlainObject(child)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

    const type = normalizedNodeType(child);
    if (isRichTextNode(child)) {
      if (type && type !== "text") throw new Error(UNSUPPORTED_CONTENT_ERROR);
      if (hasRichChildrenKey(child)) throw new Error(UNSUPPORTED_CONTENT_ERROR);
      if (child.marks != null && (!Array.isArray(child.marks) || child.marks.length > 0)) {
        throw new Error(UNSUPPORTED_CONTENT_ERROR);
      }
      continue;
    }

    if (type === "hardbreak") continue;
    throw new Error(UNSUPPORTED_CONTENT_ERROR);
  }
}

function validateRichBlockquote(node: Record<string, any>): void {
  validateRichChildrenShape(node);
  for (const child of richChildren(node)) {
    if (typeof child === "string" || isRichTextNode(child)) {
      validateRichInlineNode(child);
      continue;
    }
    if (!isPlainObject(child)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

    const type = normalizedNodeType(child);
    if (!isRichParagraphType(type)) throw new Error(UNSUPPORTED_CONTENT_ERROR);
    validateRichInlineChildren(child);
  }
}

function validateRichRule(node: Record<string, any>): void {
  validateRichChildrenShape(node);
  if (richChildren(node).length > 0) throw new Error(UNSUPPORTED_CONTENT_ERROR);
}

function validateTopLevelRichNode(node: any): void {
  if (!isPlainObject(node)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

  const type = normalizedNodeType(node);
  if (!isSupportedRichNodeType(type)) throw new Error(UNSUPPORTED_CONTENT_ERROR);

  if (isRichParagraphType(type)) {
    validateRichInlineChildren(node);
    return;
  }
  if (type === "header" || type === "heading") {
    richHeadingTag(node);
    validateRichInlineChildren(node);
    return;
  }
  if (type === "codeblock") {
    validateRichCodeBlock(node);
    return;
  }
  if (type === "blockquote") {
    validateRichBlockquote(node);
    return;
  }
  if (type === "horizontalrule" || type === "rule" || type === "hr") {
    validateRichRule(node);
    return;
  }

  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}

function hasRichMark(marks: any[], types: string[]): boolean {
  return marks.some((mark) => types.includes(normalizedMarkType(mark)));
}

function findRichLinkHref(marks: any[]): string | undefined {
  const linkMark = marks.find((mark) => normalizedMarkType(mark) === "link");
  if (!isPlainObject(linkMark) || !isPlainObject(linkMark.attrs)) return undefined;

  if (typeof linkMark.attrs.href === "string") return linkMark.attrs.href;
  if (typeof linkMark.attrs.url === "string") return linkMark.attrs.url;
  return undefined;
}

function applyRichTextMarks(text: string, marks: any): StoryInline[] {
  const markList = Array.isArray(marks) ? marks : [];
  const linkHref = findRichLinkHref(markList);

  let inlines: StoryInline[] = linkHref
    ? [{ link: { href: linkHref, content: text } }]
    : hasRichMark(markList, ["code", "inlinecode"])
      ? [{ "inline-code": text }]
      : [text];

  if (hasRichMark(markList, ["strike", "strikethrough", "s"])) {
    inlines = [{ strike: inlines }];
  }
  if (hasRichMark(markList, ["italic", "italics", "em"])) {
    inlines = [{ italics: inlines }];
  }
  if (hasRichMark(markList, ["bold", "strong"])) {
    inlines = [{ bold: inlines }];
  }

  return inlines;
}

function extractRichInlines(node: any): StoryInline[] {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return mergeAdjacentStrings(node.flatMap(extractRichInlines));
  if (typeof node !== "object") return [];

  if (typeof node.text === "string") return applyRichTextMarks(node.text, node.marks);
  if (normalizedNodeType(node) === "hardbreak") return [{ break: null }];

  const children = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.content)
      ? node.content
      : [];

  return mergeAdjacentStrings(children.flatMap(extractRichInlines));
}

function extractRichBlockInlines(node: any): StoryInline[] {
  const groups = richChildren(node)
    .map((child) => trimInlineText(extractRichInlines(child)))
    .filter((group) => group.length > 0);

  if (groups.length === 0) return trimInlineText(extractRichInlines(node));

  const inlines: StoryInline[] = [];
  groups.forEach((group, index) => {
    if (index > 0) inlines.push({ break: null });
    inlines.push(...group);
  });
  return mergeAdjacentStrings(inlines);
}

function trimInlineText(inlines: StoryInline[]): StoryInline[] {
  const result = inlines.slice();

  while (typeof result[0] === "string" && result[0].trim() === "") {
    result.shift();
  }
  while (
    result.length > 0 &&
    typeof result[result.length - 1] === "string" &&
    (result[result.length - 1] as string).trim() === ""
  ) {
    result.pop();
  }

  if (typeof result[0] === "string") {
    result[0] = result[0].trimStart();
  }

  if (typeof result[result.length - 1] === "string") {
    result[result.length - 1] = (result[result.length - 1] as string).trimEnd();
  }

  return mergeAdjacentStrings(result.filter((inline) => inline !== ""));
}

function richJsonToStory(input: any): Story {
  const nodes = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray(input.content)
      ? input.content
      : [];

  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  nodes.forEach(validateTopLevelRichNode);

  const story: Story = [];
  for (const node of nodes) {
    if (!isPlainObject(node)) continue;
    const type = normalizedNodeType(node);

    const richText = extractRichText(node);
    const text = richText.trim();

    if (type === "horizontalrule" || type === "rule" || type === "hr") {
      story.push({ block: { rule: null } });
      continue;
    }

    if (type === "codeblock") {
      const lang =
        typeof node.attrs?.language === "string"
          ? node.attrs.language
          : typeof node.attrs?.lang === "string"
            ? node.attrs.lang
            : typeof node.language === "string"
              ? node.language
              : typeof node.lang === "string"
                ? node.lang
                : "plaintext";
      story.push({
        block: {
          code: {
            code: richText.replace(/^\n+|\n+$/g, ""),
            lang,
          },
        },
      });
      continue;
    }

    if (!text) continue;

    if (type === "header" || type === "heading") {
      const content = trimInlineText(extractRichInlines(node));
      story.push({
        block: {
          header: {
            tag: richHeadingTag(node),
            content,
          },
        },
      });
      continue;
    }

    if (type === "blockquote") {
      const inlines = extractRichBlockInlines(node);
      if (inlines.length > 0) {
        story.push({ inline: [{ blockquote: inlines }] });
      }
      continue;
    }

    const inlines = trimInlineText(extractRichInlines(node));
    if (inlines.length > 0) {
      story.push({ inline: inlines });
    }
  }

  return story;
}

export function normalizeNotebookContent(raw: any): Story {
  if (isStory(raw)) return raw;

  const story = richJsonToStory(raw);
  if (story.length > 0) return story;

  throw new Error(UNSUPPORTED_CONTENT_ERROR);
}
