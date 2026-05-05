#!/usr/bin/env npx ts-node

/**
 * Post to a Tlon notebook (diary channel)
 *
 * Usage:
 *   npx ts-node scripts/notebook-post.ts <nest> <title> [--image <url>] [--content <json-file>]
 *
 * Examples:
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post Title"
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post" --image https://example.com/cover.png
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post" --content article.json
 *
 * If no --content is provided, reads from stdin (expects JSON array of Story verses).
 */

import * as fs from "fs";
import { getCurrentUserId, sendPost } from "@tloncorp/api";
import { ensureClient } from "./api-client";
import { markdownToStory, type Story } from "./story";

interface PostResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

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

function normalizeContent(raw: any, title: string): Story {
  if (isStory(raw)) return raw;

  const markdown = richJsonToMarkdown(raw);
  if (markdown.trim().length > 0) {
    const story = markdownToStory(markdown);
    if (story.length > 0) return story;
  }

  // Safe fallback: keep command usable even with unknown rich-text shapes.
  return [{ inline: [title] }];
}

export async function postToNotebook(
  nest: string,
  title: string,
  content: Story,
  image?: string
): Promise<PostResult> {
  const authorId = getCurrentUserId();
  const sentAt = Date.now();

  try {
    await sendPost({
      channelId: nest,
      authorId,
      sentAt,
      content,
      metadata: {
        title,
        description: "",
        image: image || "",
        cover: "",
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: npx ts-node scripts/notebook-post.ts <nest> <title> [options]

Arguments:
  nest    Diary channel nest (e.g., diary/~host/channel-name)
  title   Post title

Options:
  --image <url>     Cover image URL
  --content <file>  JSON file with Story content (array of verses)
  --stdin           Read content from stdin as JSON

If no content is provided, creates a simple post with the title only.

Examples:
  npx ts-node scripts/notebook-post.ts diary/~host/notes "Hello World"
  npx ts-node scripts/notebook-post.ts diary/~host/notes "My Post" --image https://example.com/img.png
  echo '[{"inline":["Hello!"]}]' | npx ts-node scripts/notebook-post.ts diary/~host/notes "Test" --stdin
`);
    process.exit(args.includes("--help") || args.includes("-h") ? 0 : 1);
  }

  const nest = args[0];
  const title = args[1];

  let image: string | undefined;
  let content: Story = [{ inline: [title] }]; // Default content is just the title

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--image" && args[i + 1]) {
      image = args[++i];
    } else if (args[i] === "--content" && args[i + 1]) {
      const file = args[++i];
      const data = fs.readFileSync(file, "utf-8");
      content = normalizeContent(JSON.parse(data), title);
    } else if (args[i] === "--stdin") {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString("utf-8");
      content = normalizeContent(JSON.parse(data), title);
    }
  }

  console.log(`Posting to: ${nest}`);
  console.log(`Title: ${title}`);
  if (image) console.log(`Image: ${image}`);

  await ensureClient(['channels']);
  const result = await postToNotebook(nest, title, content, image);

  if (result.success) {
    console.log(`✓ Posted successfully!`);
    process.exit(0);
  } else {
    console.error(`✗ Failed: ${result.error}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
