#!/usr/bin/env npx ts-node
/**
 * Channel post management for Tlon
 *
 * Note: Sending and replying to channel posts is handled by the openclaw-tlon
 * channel plugin. This script handles reactions, edits, and deletes only.
 *
 * Usage:
 *   npx ts-node scripts/posts.ts react <channel> <post-id> <emoji>
 *   npx ts-node scripts/posts.ts unreact <channel> <post-id>
 *   npx ts-node scripts/posts.ts edit <channel> <post-id> <message>
 *   npx ts-node scripts/posts.ts delete <channel> <post-id>
 *
 * Channel format: chat/~host/channel-name, diary/~host/channel-name, heap/~host/channel-name
 */

import * as fs from "fs";
import { addReaction, deletePost, editPost, getChannelPosts, getCurrentUserId, removeReaction, sendPost } from "@tloncorp/api";
import type { Post } from "@tloncorp/api";
import { ensureClient } from "./api-client";
import { markdownToStory, type Story } from "./story";

// Strip optional ~ship/ prefix from a post ID, returning just the numeric part
function extractNumericId(id: string): string {
  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

// Format a post ID as @ud (with dots every 3 digits)
// This is required for reactions to work properly
function formatUd(id: string): string {
  const clean = id.replace(/\./g, "");
  const parts: string[] = [];
  for (let i = clean.length; i > 0; i -= 3) {
    parts.unshift(clean.slice(Math.max(0, i - 3), i));
  }
  return parts.join(".");
}

// Parse content into Story format with rich markdown support
function parseContent(message: string): Story {
  return markdownToStory(message);
}

// Fetch existing post to preserve metadata during edits
async function fetchExistingPost(
  nest: string,
  postId: string
): Promise<Post | null> {
  const formattedId = formatUd(extractNumericId(postId));
  try {
    const data = await getChannelPosts({
      channelId: nest,
      mode: "around",
      cursor: formattedId,
      count: 1,
      includeReplies: false,
    });
    
    // Find the exact post by ID
    const post = data.posts.find(p => formatUd(extractNumericId(p.id)) === formattedId);
    return post || null;
  } catch (error) {
    return null;
  }
}

// React to a post
async function reactToPost(
  nest: string,
  postId: string,
  react: string
): Promise<{ success: boolean; error?: string }> {
  const our = getCurrentUserId();
  const formattedId = formatUd(extractNumericId(postId));

  try {
    await addReaction({
      channelId: nest,
      postId: formattedId,
      emoji: react,
      our,
      postAuthor: our,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Remove reaction from a post
async function unreactToPost(
  nest: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const our = getCurrentUserId();
  const formattedId = formatUd(extractNumericId(postId));

  try {
    await removeReaction({
      channelId: nest,
      postId: formattedId,
      our,
      postAuthor: our,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Edit a post (channels only, not DMs)
// Note: postId must be in @da format
async function editChannelPost(
  nest: string,
  postId: string,
  newContent: string,
  metadata?: { title?: string; image?: string; description?: string; cover?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authorId = getCurrentUserId();
    const sentAt = Date.now();
    const content = parseContent(newContent);

    await editPost({
      channelId: nest,
      postId: formatUd(extractNumericId(postId)),
      authorId,
      sentAt,
      content,
      metadata,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Edit a post with pre-parsed Story content (for rich notebook editing)
async function editChannelPostWithContent(
  nest: string,
  postId: string,
  content: Story,
  metadata?: { title?: string; image?: string; description?: string; cover?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authorId = getCurrentUserId();
    const sentAt = Date.now();

    await editPost({
      channelId: nest,
      postId: formatUd(extractNumericId(postId)),
      authorId,
      sentAt,
      content,
      metadata,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete a post
// Note: postId must be in @da format (e.g., "170.141.184.507.800.833.818.237.178.278.053.937.152")
async function deleteChannelPost(
  nest: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deletePost(nest, formatUd(extractNumericId(postId)), getCurrentUserId());
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await ensureClient(['channels']);

  try {
    switch (command) {
      case "react": {
        const [_, channel, postId, emoji] = args;
        if (!channel || !postId || !emoji) {
          console.error("Usage: posts.ts react <channel> <post-id> <emoji>");
          process.exit(1);
        }
        const result = await reactToPost(channel, postId, emoji);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log("✓ Reaction added");
        break;
      }

      case "unreact": {
        const [_, channel, postId] = args;
        if (!channel || !postId) {
          console.error("Usage: posts.ts unreact <channel> <post-id>");
          process.exit(1);
        }
        const result = await unreactToPost(channel, postId);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log("✓ Reaction removed");
        break;
      }

      case "edit": {
        const channel = args[1];
        const postId = args[2];
        const titleIdx = args.indexOf("--title");
        const contentIdx = args.indexOf("--content");
        const imageIdx = args.indexOf("--image");
        
        // Find where flags start
        let flagStart = args.length;
        if (titleIdx !== -1 && titleIdx < flagStart) flagStart = titleIdx;
        if (contentIdx !== -1 && contentIdx < flagStart) flagStart = contentIdx;
        if (imageIdx !== -1 && imageIdx < flagStart) flagStart = imageIdx;
        
        const newTitle = titleIdx !== -1 ? args[titleIdx + 1] : undefined;
        const contentFile = contentIdx !== -1 ? args[contentIdx + 1] : undefined;
        const newImage = imageIdx !== -1 ? args[imageIdx + 1] : undefined;
        
        if (!channel || !postId) {
          console.error("Usage: posts.ts edit <channel> <post-id> [message] [--title <title>] [--image <url>] [--content <json-file>]");
          process.exit(1);
        }

        // Fetch existing post to preserve metadata not being explicitly changed
        const existingPost = await fetchExistingPost(channel, postId);
        
        // Merge: new values override existing, existing values preserved if not specified
        const metadata: { title?: string; image?: string; description?: string; cover?: string } = {
          title: newTitle ?? existingPost?.title ?? undefined,
          image: newImage ?? existingPost?.image ?? undefined,
          description: existingPost?.description ?? undefined,
          cover: existingPost?.cover ?? undefined,
        };

        let result;
        if (contentFile) {
          // Rich content from JSON file
          const jsonContent = fs.readFileSync(contentFile, "utf-8");
          const content = JSON.parse(jsonContent) as Story;
          result = await editChannelPostWithContent(channel, postId, content, metadata);
        } else {
          // Plain text/markdown message
          const message = args.slice(3, flagStart).join(" ");
          if (!message) {
            console.error("Usage: posts.ts edit <channel> <post-id> <message> [--title <title>] [--image <url>] [--content <json-file>]");
            process.exit(1);
          }
          result = await editChannelPost(channel, postId, message, metadata);
        }
        
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log("✓ Post edited");
        break;
      }

      case "delete": {
        const channel = args[1];
        const postId = args[2];
        if (!channel || !postId) {
          console.error("Usage: posts.ts delete <channel> <post-id>");
          process.exit(1);
        }
        const result = await deleteChannelPost(channel, postId);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log("✓ Post deleted");
        break;
      }

      case "blob": {
        const nestArg = args[1];
        if (!nestArg) {
          console.error("Usage: posts.ts blob <nest> --blob '<json>' | --blob-file <path> [--caption <text>]");
          process.exit(1);
        }

        const blobIdx = args.indexOf("--blob");
        const blobFileIdx = args.indexOf("--blob-file");
        const captionIdx = args.indexOf("--caption");

        let blobJson: string | undefined;
        if (blobIdx !== -1) {
          blobJson = args[blobIdx + 1];
        } else if (blobFileIdx !== -1) {
          const filePath = args[blobFileIdx + 1];
          if (!filePath) {
            console.error("--blob-file requires a path argument");
            process.exit(1);
          }
          blobJson = fs.readFileSync(filePath, "utf-8").trim();
        }

        if (!blobJson) {
          console.error("Either --blob '<json>' or --blob-file <path> is required");
          process.exit(1);
        }

        let blobData: unknown[];
        try {
          blobData = JSON.parse(blobJson);
          if (!Array.isArray(blobData)) throw new Error("Blob must be a JSON array");
        } catch (e: any) {
          console.error(`Invalid blob JSON: ${e.message}`);
          process.exit(1);
        }

        const caption = captionIdx !== -1 ? args[captionIdx + 1] : undefined;
        const our = getCurrentUserId();
        const sentAt = Date.now();
        const content = caption ? [{ inline: [caption] }] : [{ inline: [""] }];

        await sendPost({
          channelId: nestArg,
          authorId: our,
          sentAt,
          content,
          blob: JSON.stringify(blobData),
        });

        console.log("✓ Blob posted");
        break;
      }

      case "send":
        console.error("error: Channel post send is handled by the Tlon channel plugin.");
        console.error("Use the channel message tool with channel=tlon instead.");
        process.exit(1);
        break;

      case "reply":
        console.error("error: Channel post reply is handled by the Tlon channel plugin.");
        console.error("Use the channel message tool with channel=tlon and replyTo instead.");
        process.exit(1);
        break;

      default:
        console.log(`Usage: posts.ts <command>

Note: Sending and replying to posts is handled by the Tlon channel plugin.

Commands:
  react <channel> <post-id> <emoji>     React to a post with an emoji
  unreact <channel> <post-id>           Remove your reaction from a post
  edit <channel> <post-id> <message>    Edit a post [--title <t>] [--image <url>] [--content <json>]
  delete <channel> <post-id>            Delete a post
  blob <nest> --blob '<json>'           Post an A2UI blob
           [--blob-file <path>]         Post blob from JSON file
           [--caption <text>]           Optional caption text

Edit options:
  --title <title>      Set/update notebook post title
  --image <url>        Set/update cover image (notebooks)
  --content <file>     Use Story JSON file for rich content (notebooks)

Examples:
  # Edit with plain text
  tlon posts edit chat/~host/channel 170.141... "Updated message"
  
  # Edit notebook with rich Story JSON and new cover image
  tlon posts edit diary/~host/notes 170.141... --title "New Title" --image https://example.com/cover.jpg --content article.json

Channel format: chat/~host/channel-name, diary/~host/name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.
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
