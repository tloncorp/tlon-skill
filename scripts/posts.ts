#!/usr/bin/env npx ts-node
/**
 * Post to Tlon channels (chat, diary, heap)
 *
 * Usage:
 *   npx ts-node scripts/posts.ts send <channel> <message>
 *   npx ts-node scripts/posts.ts reply <channel> <post-id> <message>
 *   npx ts-node scripts/posts.ts react <channel> <post-id> <emoji>
 *   npx ts-node scripts/posts.ts unreact <channel> <post-id>
 *   npx ts-node scripts/posts.ts delete <channel> <post-id>
 *
 * Channel format: chat/~host/channel-name, diary/~host/channel-name, heap/~host/channel-name
 */

import { getConfig, poke, getCurrentShip, normalizeShip } from "./urbit-client";

// Generate a post ID in @da format from Unix timestamp
function generatePostId(): string {
  // Return Unix timestamp in milliseconds - the backend handles conversion
  return Date.now().toString();
}

// Parse content into Story format (array of verses)
function parseContent(message: string): any[] {
  // Simple implementation: treat as inline text with @mentions and linebreaks
  const inlines: any[] = [];
  
  // Split by ship mentions
  const parts = message.split(/(~[a-z]+-[a-z]+(?:-[a-z]+)*)/g);
  
  for (const part of parts) {
    if (!part) continue;
    
    if (part.match(/^~[a-z]+-[a-z]+(?:-[a-z]+)*$/)) {
      // Ship mention
      inlines.push({ ship: part });
    } else {
      // Handle newlines
      const lines = part.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          inlines.push(lines[i]);
        }
        if (i < lines.length - 1) {
          inlines.push({ break: null });
        }
      }
    }
  }
  
  return [{ inline: inlines }];
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

// Send a post to a channel
async function sendPost(nest: string, message: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  const config = getConfig();
  const author = getCurrentShip();
  const sent = Date.now();
  const content = parseContent(message);
  const kind = getChannelKind(nest);

  const essay = {
    content,
    author,
    sent,
    kind,
    blob: null,
    meta: null,
  };

  try {
    await poke({
      app: "channels",
      mark: "channel-action-1",
      json: {
        channel: {
          nest,
          action: {
            post: {
              add: essay,
            },
          },
        },
      },
    });

    return { success: true, postId: `${author}/${sent}` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Reply to a post in a channel
async function replyToPost(
  nest: string,
  postId: string,
  message: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const config = getConfig();
  const author = getCurrentShip();
  const sent = Date.now();
  const content = parseContent(message);

  const memo = {
    content,
    author,
    sent,
  };

  try {
    await poke({
      app: "channels",
      mark: "channel-action-1",
      json: {
        channel: {
          nest,
          action: {
            post: {
              reply: {
                id: postId,
                action: {
                  add: memo,
                },
              },
            },
          },
        },
      },
    });

    return { success: true, replyId: `${author}/${sent}` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// React to a post
async function reactToPost(
  nest: string,
  postId: string,
  react: string
): Promise<{ success: boolean; error?: string }> {
  const ship = getCurrentShip();

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
                id: postId,
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
                id: postId,
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

// Delete a post
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
              del: postId,
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
        const nest = args[1];
        const message = args.slice(2).join(" ");
        if (!nest || !message) {
          console.error("Usage: posts.ts send <channel> <message>");
          console.error("Example: posts.ts send chat/~sampel/general Hello world!");
          process.exit(1);
        }
        result = await sendPost(nest, message);
        break;
      }

      case "reply": {
        const nest = args[1];
        const postId = args[2];
        const message = args.slice(3).join(" ");
        if (!nest || !postId || !message) {
          console.error("Usage: posts.ts reply <channel> <post-id> <message>");
          console.error("Example: posts.ts reply chat/~sampel/general 170141184505123456789 Nice post!");
          process.exit(1);
        }
        result = await replyToPost(nest, postId, message);
        break;
      }

      case "react": {
        const nest = args[1];
        const postId = args[2];
        const emoji = args[3];
        if (!nest || !postId || !emoji) {
          console.error("Usage: posts.ts react <channel> <post-id> <emoji>");
          console.error("Example: posts.ts react chat/~sampel/general 170141184505123456789 👍");
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

Commands:
  send <channel> <message>              Post a message to a channel
  reply <channel> <post-id> <message>   Reply to a post
  react <channel> <post-id> <emoji>     React to a post with an emoji
  unreact <channel> <post-id>           Remove your reaction from a post
  delete <channel> <post-id>            Delete a post

Channel format: chat/~host/channel-name, diary/~host/name, heap/~host/name
Post IDs are Unix timestamps (milliseconds) or @da format numbers.

Examples:
  posts.ts send chat/~sampel/general "Hello everyone!"
  posts.ts react chat/~sampel/general 1706123456789 👍
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
