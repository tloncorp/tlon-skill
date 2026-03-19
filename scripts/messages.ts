#!/usr/bin/env npx ts-node
/**
 * Messages API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-slug
 *   npx ts-node scripts/messages.ts context <channel|~ship> <postId> [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts post <channel|~ship> <postId> [--author ~ship] [--resolve-cites]
 *
 * Options:
 *   --resolve-cites, --quotes   Fetch and display quoted/cited message content
 */

import {
  getChannelPosts,
  getPostReference,
  getPostWithReplies,
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

async function printPosts(posts: Post[], resolve: boolean, highlightId?: string) {
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
    const marker = highlightId && post.id === highlightId ? " ◀ TARGET" : "";

    console.log(`- ${author} @ ${time}${replySuffix}${marker}`);
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

// Fetch context around a specific post (messages before and after)
// Uses the backend's native %around scry which fetches N posts in each
// direction plus the target post itself in a single request.
async function fetchContext(
  channelId: string,
  postId: string,
  limit: number = 10,
  resolve: boolean = false
): Promise<void> {
  console.log(`Fetching context around post ${postId} in ${channelId}`);
  console.log(`Limit: ${limit} messages each direction${resolve ? " (resolving quotes)" : ""}\n`);

  try {
    // The backend supports %around mode which fetches N older + N newer + the
    // target post in one scry. The JS API types only declare "older"|"newer"
    // but the path builder is generic, so "around" just works at runtime.
    const data = await getChannelPosts({
      channelId,
      cursor: postId,
      mode: "around" as any,
      count: limit,
      includeReplies: true,
    });

    console.log(`=== Context around ${postId} (${data.posts.length} messages) ===\n`);

    await printPosts(data.posts, resolve, postId);
  } catch (error: any) {
    console.error(`Error fetching context: ${error.message}`);
  }
}

// Fetch a single post (with replies if it's a thread)
async function fetchPost(
  channelId: string,
  postId: string,
  authorId?: string,
  resolve: boolean = false
): Promise<void> {
  console.log(`Fetching post ${postId} from ${channelId}\n`);

  try {
    const post = await getPostWithReplies({
      channelId,
      postId,
      authorId,
    });

    if (!post) {
      console.log("Post not found.");
      return;
    }

    const author = post.authorId || "unknown";
    const time = formatTime(post.sentAt);
    const text = extractText(post.content);

    console.log(`=== Post ${postId} ===\n`);
    console.log(`Author: ${author}`);
    console.log(`Time: ${time}`);
    console.log(`ID: ${post.id}`);
    if (text) {
      console.log(`\n${text}`);
    }

    if (resolve) {
      const cites = await resolveCites(post);
      for (const cite of cites) {
        console.log(`\n> ${cite}`);
      }
    }

    if (post.replies && post.replies.length > 0) {
      console.log(`\n--- Replies (${post.replies.length}) ---\n`);
      await printPosts(post.replies, resolve);
    }
  } catch (error: any) {
    console.error(`Error fetching post: ${error.message}`);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await ensureClient();

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

      case "context": {
        const target = args[1];
        const postId = args[2];
        if (!target || !postId) {
          console.log(
            "Usage: messages.ts context <channel|~ship> <postId> [--limit N] [--resolve-cites]"
          );
          process.exit(1);
        }
        await fetchContext(target, postId, limit, resolveCites);
        break;
      }

      case "post": {
        const target = args[1];
        const postId = args[2];
        if (!target || !postId) {
          console.log(
            "Usage: messages.ts post <channel|~ship> <postId> [--author ~ship] [--resolve-cites]"
          );
          process.exit(1);
        }
        let author: string | undefined;
        const authorIdx = args.indexOf("--author");
        if (authorIdx !== -1 && args[authorIdx + 1]) {
          author = normalizeShip(args[authorIdx + 1]);
        }
        await fetchPost(target, postId, author, resolveCites);
        break;
      }

      default:
        console.log(`Usage: messages.ts <command>

Commands:
  dm ~ship                                    Show DM history
  channel <nest>                              Show channel messages
  history <nest>                              Alias for channel
  search "query" --channel <nest>             Search in channel
  context <channel|~ship> <postId>            Show messages around a post
  post <channel|~ship> <postId>               Fetch a single post with replies

Examples:
  npx ts-node scripts/messages.ts dm ~sampel-palnet --limit 10
  npx ts-node scripts/messages.ts channel chat/~host/channel-slug --limit 20
  npx ts-node scripts/messages.ts search "hello" --channel chat/~host/slug
  npx ts-node scripts/messages.ts context chat/~host/slug 170.141.184... --limit 5
  npx ts-node scripts/messages.ts post chat/~host/slug 170.141.184...
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
