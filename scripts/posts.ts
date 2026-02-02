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

import { getConfig, poke, getCurrentShip, normalizeShip } from "./urbit-client";
import { scot, da } from "@urbit/aura";
import { markdownToStory, type Story } from "./story";

// Strip optional ~ship/ prefix from a post ID, returning just the numeric part
function extractNumericId(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

// Format a post ID as @ud (with dots every 3 digits)
// This is required for reactions to work properly
function formatUd(id: string): string {
  // Remove any existing dots
  const clean = id.replace(/\./g, '');
  // Add dots every 3 digits from the right
  const parts: string[] = [];
  for (let i = clean.length; i > 0; i -= 3) {
    parts.unshift(clean.slice(Math.max(0, i - 3), i));
  }
  return parts.join('.');
}

// Parse content into Story format with rich markdown support
function parseContent(message: string): Story {
  return markdownToStory(message);
}

// Determine channel kind from nest
function getChannelKind(nest: string): string {
  const [kind] = nest.split('/');
  switch (kind) {
    case 'diary': return '/diary';
    case 'heap': return '/heap';
    case 'chat':
    default: return '/chat';
  }
}

// sendPost: Handled by the openclaw-tlon channel plugin (sendText).
// Use the Tlon channel's message tool instead of tlon-run for posting to channels.

// replyToPost: Handled by the openclaw-tlon channel plugin (sendText with replyToId).
// Use the Tlon channel's message tool with replyTo instead of tlon-run for replies.

// React to a post
async function reactToPost(
  nest: string,
  postId: string,
  react: string
): Promise<{ success: boolean; error?: string }> {
  const ship = getCurrentShip();
  const formattedId = formatUd(extractNumericId(postId));

  try {
    await poke({
      app: "channels",
      mark: "channel-action-1",
      json: {
        channel: {
          nest,
          action: {
            post: {
              "add-react": {
                id: formattedId,
                react,
                ship,
              },
            },
          },
        },
      },
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
  const ship = getCurrentShip();
  const formattedId = formatUd(extractNumericId(postId));

  try {
    await poke({
      app: "channels",
      mark: "channel-action-1",
      json: {
        channel: {
          nest,
          action: {
            post: {
              "del-react": {
                id: formattedId,
                ship,
              },
            },
          },
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Edit a post (channels only, not DMs)
// Note: postId must be in @da format
async function editPost(
  nest: string,
  postId: string,
  newContent: string,
  metadata?: { title?: string; image?: string; description?: string; cover?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getConfig();
    const author = `~${config.ship}`;
    const sent = Date.now();
    const content = parseContent(newContent);
    
    // Determine kind from nest
    const kind = nest.startsWith("diary/") ? "/diary" 
               : nest.startsWith("heap/") ? "/heap" 
               : "/chat";
    
    const essay: Record<string, any> = {
      content,
      author,
      sent,
      kind,
      blob: null,
      meta: metadata ? {
        title: metadata.title || "",
        description: metadata.description || "",
        image: metadata.image || "",
        cover: metadata.cover || "",
      } : null,
    };

    await poke({
      app: "channels",
      mark: "channel-action-1",
      json: {
        channel: {
          nest,
          action: {
            post: {
              edit: {
                id: formatUd(extractNumericId(postId)),
                essay,
              },
            },
          },
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete a post
// Note: postId must be in @da format (e.g., "170.141.184.507.800.833.818.237.178.278.053.937.152")
// NOT the Unix timestamp. Use messages.ts to fetch posts and see their actual IDs.
async function deletePost(
  nest: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await poke({
      app: "channels",
      mark: "channel-action-1",
      json: {
        channel: {
          nest,
          action: {
            post: {
              del: formatUd(extractNumericId(postId)),
            },
          },
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    let result: any;

    switch (command) {
      case "send": {
        console.error("error: Channel post send is handled by the Tlon channel plugin.");
        console.error("Use the channel message tool with channel=tlon instead.");
        process.exit(1);
        break;
      }

      case "reply": {
        console.error("error: Channel post reply is handled by the Tlon channel plugin.");
        console.error("Use the channel message tool with channel=tlon and replyTo instead.");
        process.exit(1);
        break;
      }

      case "react": {
        const nest = args[1];
        const postId = args[2];
        const emoji = args[3];
        if (!nest || !postId || !emoji) {
          console.error("Usage: posts.ts react <channel> <post-id> <emoji>");
          console.error("Example: posts.ts react chat/~sampel/general 170.141.184.507... 👍");
          process.exit(1);
        }
        result = await reactToPost(nest, postId, emoji);
        break;
      }

      case "unreact": {
        const nest = args[1];
        const postId = args[2];
        if (!nest || !postId) {
          console.error("Usage: posts.ts unreact <channel> <post-id>");
          process.exit(1);
        }
        result = await unreactToPost(nest, postId);
        break;
      }

      case "edit": {
        const nest = args[1];
        const postId = args[2];
        // Check for --title flag for notebook posts
        const titleIdx = args.indexOf("--title");
        let title: string | undefined;
        let messageStart = 3;
        if (titleIdx !== -1 && args[titleIdx + 1]) {
          title = args[titleIdx + 1];
          // Remove --title and its value from message construction
          const beforeTitle = args.slice(3, titleIdx);
          const afterTitle = args.slice(titleIdx + 2);
          const message = [...beforeTitle, ...afterTitle].join(" ");
          if (!nest || !postId || !message) {
            console.error("Usage: posts.ts edit <channel> <post-id> <new-message> [--title <title>]");
            process.exit(1);
          }
          result = await editPost(nest, postId, message, { title });
        } else {
          const message = args.slice(3).join(" ");
          if (!nest || !postId || !message) {
            console.error("Usage: posts.ts edit <channel> <post-id> <new-message> [--title <title>]");
            process.exit(1);
          }
          result = await editPost(nest, postId, message);
        }
        break;
      }

      case "delete": {
        const nest = args[1];
        const postId = args[2];
        if (!nest || !postId) {
          console.error("Usage: posts.ts delete <channel> <post-id>");
          process.exit(1);
        }
        result = await deletePost(nest, postId);
        break;
      }

      default:
        console.error(`
Usage: posts.ts <command> [args]

Note: Sending and replying to posts is handled by the Tlon channel plugin.
Use tlon-run only for reactions, edits, and deletes.

Commands:
  react <channel> <post-id> <emoji>     React to a post with an emoji
  unreact <channel> <post-id>           Remove your reaction from a post
  edit <channel> <post-id> <message>    Edit a post [--title <t> for notebooks]
  delete <channel> <post-id>            Delete a post

Channel format: chat/~host/channel-name, diary/~host/name, heap/~host/name
Post IDs are @ud format with dots (e.g., 170.141.184.507...).
Use 'tlon-run messages channel <nest> --limit N' to see post IDs.

Examples:
  posts.ts react chat/~sampel/general 170.141.184.507... 👍
  posts.ts delete chat/~sampel/general 170.141.184.507...
`);
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
