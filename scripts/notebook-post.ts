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
import { normalizeNotebookContent } from "./notebook-content";
import type { Story } from "./story";

interface PostResult {
  success: boolean;
  error?: string;
  messageId?: string;
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
      content = normalizeNotebookContent(JSON.parse(data));
    } else if (args[i] === "--stdin") {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString("utf-8");
      content = normalizeNotebookContent(JSON.parse(data));
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
