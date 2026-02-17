#!/usr/bin/env npx ts-node
/**
 * Messages API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-slug
 *
 * Options:
 *   --resolve-cites, --quotes   Fetch and display quoted/cited message content
 */

import {
  getChannelPosts,
  getPostReference,
  getTextContent,
  searchChannel,
} from "@tloncorp/api";
import type { ContentReference, Post } from "@tloncorp/api";
import { ensureClient, normalizeShip } from "./api-client";

// Extract text content from a Story
function extractText(content: any): string {
  if (!content) return "";
  // getTextContent expects an array (Story/Verse[])
  if (!Array.isArray(content)) {
    // Handle case where content might be wrapped or in unexpected format
    if (typeof content === "string") return content;
    if (content.story && Array.isArray(content.story)) {
      return getTextContent(content.story) || "";
    }
    return JSON.stringify(content);
  }
  return getTextContent(content) || "";
}

function extractChannelReferences(content: any): ContentReference[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (verse) => verse && typeof verse === "object" && verse.type === "reference"
  ) as ContentReference[];
}

// Format a timestamp
function formatTime(timeVal: string | number): string {
  try {
    const num = typeof timeVal === "number" ? timeVal : parseInt(timeVal, 10);
    if (!isNaN(num) && num > 1600000000000) {
      const date = new Date(num);
      return date.toLocaleString();
    }
    const timeStr = String(timeVal);
    const daNum = BigInt(timeStr.replace(/\./g, ""));
    const DA_SECOND = BigInt("18446744073709551616");
    const DA_UNIX_EPOCH = BigInt("170141184475152167957503069145530368000");
    const offset = DA_SECOND / BigInt(2000);
    const epochAdjusted = offset + (daNum - DA_UNIX_EPOCH);
    const unixMs = Math.round(Number((epochAdjusted * BigInt(1000)) / DA_SECOND));

    const date = new Date(unixMs);
    if (date.getFullYear() > 2020 && date.getFullYear() < 2100) {
      return date.toLocaleString();
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function resolveCites(post: Post): Promise<string[]> {
  const references = extractChannelReferences(post.content);
  if (!references.length) return [];

  const citeTexts: string[] = [];
  for (const ref of references) {
    if (ref.referenceType !== "channel") continue;
    try {
      const refPost = await getPostReference({
        channelId: ref.channelId,
        postId: ref.postId,
        replyId: ref.replyId,
      });
      const text = extractText(refPost.content);
      if (text) {
        citeTexts.push(text);
      }
    } catch {
      // ignore cite failures
    }
  }
  return citeTexts;
}

async function printPosts(posts: Post[], resolve: boolean) {
  if (!posts.length) {
    console.log("No messages found.");
    return;
  }

  const sorted = [...posts].sort((a, b) => a.sentAt - b.sentAt);

  for (const post of sorted) {
    const author = post.authorId || "unknown";
    const time = formatTime(post.sentAt);
    const text = extractText(post.content);
    const replySuffix = post.parentId ? ` (reply to ${post.parentId})` : "";

    console.log(`- ${author} @ ${time}${replySuffix}`);
    console.log(`  ID: ${post.id}`);
    if (text) {
      console.log(`  ${text}`);
    }

    if (resolve) {
      const cites = await resolveCites(post);
      for (const cite of cites) {
        console.log(`  > ${cite}`);
      }
    }

    console.log("");
  }
}

// Fetch DM messages via the chat agent (not channels)
async function fetchDmMessages(
  ship: string,
  limit: number = 20,
  resolveCites: boolean = false
): Promise<void> {
  await ensureClient();
  const normalizedShip = normalizeShip(ship);

  console.log(`Fetching DMs with: ${normalizedShip}`);
  console.log(`Limit: ${limit}${resolveCites ? " (resolving quotes)" : ""}\n`);

  try {
    const data = await getChannelPosts({
      channelId: normalizedShip,
      mode: "newest",
      count: limit,
      includeReplies: true,
    });

    console.log(`=== DMs with ${normalizedShip} (${data.posts.length}) ===\n`);
    await printPosts(data.posts, resolveCites);
  } catch (error: any) {
    console.error(`Error fetching DMs: ${error.message}`);
  }
}

// Fetch messages from a channel
async function fetchMessages(
  channel: string,
  limit: number = 20,
  resolveCites: boolean = false
): Promise<void> {
  await ensureClient();

  console.log(`Fetching messages from: ${channel}`);
  console.log(`Limit: ${limit}${resolveCites ? " (resolving quotes)" : ""}\n`);

  try {
    const data = await getChannelPosts({
      channelId: channel,
      mode: "newest",
      count: limit,
      includeReplies: true,
    });

    console.log(`=== Messages in ${channel} (${data.posts.length}) ===\n`);
    await printPosts(data.posts, resolveCites);
  } catch (error: any) {
    console.error(`Error fetching messages: ${error.message}`);
    console.log("Note: Check that the channel path is correct (e.g., chat/~host/slug)");
  }
}

// Search messages in a channel
async function searchMessages(query: string, channel: string): Promise<void> {
  await ensureClient();

  console.log(`Searching "${query}" in: ${channel}\n`);

  try {
    const results = await searchChannel({
      channelId: channel,
      query,
    });

    if (!results.posts.length) {
      console.log("No results found.");
      return;
    }

    console.log(`Found ${results.posts.length} results:\n`);
    await printPosts(results.posts, false);
  } catch (error: any) {
    console.error(`Error searching messages: ${error.message}`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse --limit flag
  let limit = 20;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  const resolveCites =
    args.includes("--resolve-cites") || args.includes("--quotes");

  try {
    switch (command) {
      case "dm": {
        const ship = args[1];
        if (!ship) {
          console.log(
            "Usage: npx ts-node scripts/messages.ts dm ~ship [--limit N] [--resolve-cites]"
          );
          process.exit(1);
        }
        await fetchDmMessages(ship, limit, resolveCites);
        break;
      }

      case "channel": {
        const channelPath = args[1];
        if (!channelPath) {
          console.log(
            "Usage: npx ts-node scripts/messages.ts channel chat/~host/slug [--limit N] [--resolve-cites]"
          );
          process.exit(1);
        }
        await fetchMessages(channelPath, limit, resolveCites);
        break;
      }

      case "history": {
        const channelPath = args[1];
        if (!channelPath) {
          console.log(
            "Usage: npx ts-node scripts/messages.ts history \"chat/~host/channel-slug\" [--limit N] [--resolve-cites]"
          );
          process.exit(1);
        }
        await fetchMessages(channelPath, limit, resolveCites);
        break;
      }

      case "search": {
        const query = args[1];
        let channel: string | null = null;
        for (let i = 2; i < args.length; i++) {
          if (args[i] === "--channel" && args[i + 1]) {
            channel = args[i + 1];
          }
        }

        if (!query || !channel) {
          console.log(
            'Usage: npx ts-node scripts/messages.ts search "query" --channel chat/~host/slug'
          );
          process.exit(1);
        }
        await searchMessages(query, channel);
        break;
      }

      default:
        console.log(`Usage: messages.ts <command>

Commands:
  dm ~ship                          Show DM history
  channel <nest>                    Show channel messages
  history <nest>                    Alias for channel
  search "query" --channel <nest>   Search in channel

Examples:
  npx ts-node scripts/messages.ts dm ~sampel-palnet --limit 10
  npx ts-node scripts/messages.ts channel chat/~host/channel-slug --limit 20
  npx ts-node scripts/messages.ts search "hello" --channel chat/~host/slug
`);
        process.exit(1);
    }
    process.exit(0);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
