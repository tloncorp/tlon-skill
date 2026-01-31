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
import { getConfig, getCurrentShip } from "./urbit-client";

interface PostResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export async function postToNotebook(
  nest: string,
  title: string,
  content: any[],
  image?: string
): Promise<PostResult> {
  const config = getConfig();
  const ship = config.ship;
  const url = config.url;
  const code = config.code;

  // Authenticate
  const loginResp = await fetch(`${url}/~/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `password=${code}`,
  });

  if (!loginResp.ok) {
    return { success: false, error: `Login failed: ${loginResp.status}` };
  }

  const cookie = loginResp.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    return { success: false, error: "No auth cookie received" };
  }

  // Create channel for SSE response
  const channelId = `notebook-${Date.now()}`;
  const channelUrl = `${url}/~/channel/${channelId}`;

  const sent = Date.now();
  const author = `~${ship}`;

  const essay: Record<string, any> = {
    content,
    author,
    sent,
    kind: "/diary",
    blob: null,
    meta: {
      title,
      description: "",
      image: image || "",
      cover: "",
    },
  };

  const action = {
    channel: {
      nest,
      action: {
        post: {
          add: essay,
        },
      },
    },
  };

  // Send poke
  const pokeReq = [
    {
      id: 1,
      action: "poke",
      ship,
      app: "channels",
      mark: "channel-action-1",
      json: action,
    },
  ];

  const pokeResp = await fetch(channelUrl, {
    method: "PUT",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pokeReq),
  });

  if (!pokeResp.ok) {
    const text = await pokeResp.text();
    return { success: false, error: `Poke failed (${pokeResp.status}): ${text}` };
  }

  // Listen for SSE response
  const sseResp = await fetch(channelUrl, {
    method: "GET",
    headers: {
      Cookie: cookie,
      Accept: "text/event-stream",
    },
  });

  if (!sseResp.ok || !sseResp.body) {
    return { success: false, error: `Failed to open SSE: ${sseResp.status}` };
  }

  const reader = sseResp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: PostResult = { success: false, error: "Timeout waiting for response" };

  const timeout = setTimeout(() => {
    reader.cancel();
  }, 10000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data) {
            try {
              const event = JSON.parse(data);

              if (event.response === "poke") {
                if (event.ok === "ok") {
                  result = { success: true, messageId: `${author}/${sent}` };
                } else if (event.err) {
                  result = { success: false, error: event.err };
                }

                // Send ack
                await fetch(channelUrl, {
                  method: "PUT",
                  headers: {
                    Cookie: cookie,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify([{ id: event.id, action: "ack" }]),
                });

                reader.cancel();
                break;
              }
            } catch {
              // Not JSON, skip
            }
          }
        }
      }

      if (result.success || result.error !== "Timeout waiting for response") {
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
    reader.cancel().catch(() => {});
  }

  // Cleanup channel
  await fetch(channelUrl, {
    method: "PUT",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ id: 2, action: "delete" }]),
  }).catch(() => {});

  return result;
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
  let content: any[] = [{ inline: [title] }]; // Default content is just the title

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--image" && args[i + 1]) {
      image = args[++i];
    } else if (args[i] === "--content" && args[i + 1]) {
      const file = args[++i];
      const data = fs.readFileSync(file, "utf-8");
      content = JSON.parse(data);
    } else if (args[i] === "--stdin") {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString("utf-8");
      content = JSON.parse(data);
    }
  }

  console.log(`Posting to: ${nest}`);
  console.log(`Title: ${title}`);
  if (image) console.log(`Image: ${image}`);

  const result = await postToNotebook(nest, title, content, image);

  if (result.success) {
    console.log(`✓ Posted successfully! ID: ${result.messageId}`);
  } else {
    console.error(`✗ Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
