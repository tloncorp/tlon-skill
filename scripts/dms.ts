#!/usr/bin/env npx ts-node
/**
 * Direct Message management for Tlon
 *
 * Note: 1:1 DM send/reply is handled by the openclaw-tlon channel plugin.
 * This script handles club (group DM) messaging and DM management ops only.
 *
 * Usage:
 *   npx ts-node scripts/dms.ts send <club-id> <message>        (group DMs only)
 *   npx ts-node scripts/dms.ts reply <club-id> <post-id> <msg> (group DMs only)
 *   npx ts-node scripts/dms.ts react <ship> <post-id> <emoji>
 *   npx ts-node scripts/dms.ts unreact <ship> <post-id>
 *   npx ts-node scripts/dms.ts delete <ship> <post-id>
 *   npx ts-node scripts/dms.ts accept <ship>
 *   npx ts-node scripts/dms.ts decline <ship>
 */

import { getConfig, poke, getCurrentShip, normalizeShip } from "./urbit-client";
import { scot, da } from "@urbit/aura";
import { markdownToStory, type Story } from "./story";

// Parse content into Story format with rich markdown support
function parseContent(message: string): Story {
  return markdownToStory(message);
}

// Check if the target is a group DM (club)
function isClub(whom: string): boolean {
  return whom.startsWith("0v");
}

// sendDM: Handled by the openclaw-tlon channel plugin (sendText).
// Use the Tlon channel's message tool instead of tlon-run for 1:1 DMs.

// Send a message to a group DM (club)
async function sendClubMessage(
  clubId: string,
  message: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const author = getCurrentShip();
  const sent = Date.now();
  const content = parseContent(message);
  const idUd = scot("ud", da.fromUnix(sent));
  const id = `${author}/${idUd}`;

  try {
    await poke({
      app: "chat",
      mark: "chat-club-action-0",
      json: {
        id: clubId,
        diff: {
          uid: "0v3",
          delta: {
            writ: {
              id,
              delta: {
                add: {
                  memo: { content, author, sent },
                  kind: null,
                  time: null,
                },
              },
            },
          },
        },
      },
    });

    return { success: true, postId: id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// replyToDM: Handled by the openclaw-tlon channel plugin (sendText with replyToId).
// Use the Tlon channel's message tool instead of tlon-run for 1:1 DM replies.

// Reply in a club (group DM)
async function replyToClub(
  clubId: string,
  postId: string,
  message: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const author = getCurrentShip();
  const sent = Date.now();
  const content = parseContent(message);
  const idUd = scot("ud", da.fromUnix(sent));
  const replyId = `${author}/${idUd}`;

  try {
    await poke({
      app: "chat",
      mark: "chat-club-action-0",
      json: {
        id: clubId,
        diff: {
          uid: "0v3",
          delta: {
            writ: {
              id: postId,
              delta: {
                reply: {
                  id: replyId,
                  meta: null,
                  delta: {
                    add: {
                      memo: { content, author, sent },
                      time: null,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return { success: true, replyId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// React to a DM
async function reactToDM(
  ship: string,
  postId: string,
  react: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const author = getCurrentShip();

  try {
    await poke({
      app: "chat",
      mark: "chat-dm-action-1",
      json: {
        ship: normalizedShip,
        diff: {
          id: postId,
          delta: {
            "add-react": {
              react,
              author,
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

// Remove reaction from a DM
async function unreactToDM(
  ship: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const author = getCurrentShip();

  try {
    await poke({
      app: "chat",
      mark: "chat-dm-action-1",
      json: {
        ship: normalizedShip,
        diff: {
          id: postId,
          delta: {
            "del-react": author,
          },
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete a DM
async function deleteDM(
  ship: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);

  try {
    await poke({
      app: "chat",
      mark: "chat-dm-action",
      json: {
        ship: normalizedShip,
        diff: {
          id: postId,
          delta: {
            del: null,
          },
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Accept a DM invite
async function acceptDM(ship: string): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);

  try {
    await poke({
      app: "chat",
      mark: "chat-dm-rsvp",
      json: {
        ship: normalizedShip,
        ok: true,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Decline a DM invite
async function declineDM(ship: string): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);

  try {
    await poke({
      app: "chat",
      mark: "chat-dm-rsvp",
      json: {
        ship: normalizedShip,
        ok: false,
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
        const whom = args[1];
        const message = args.slice(2).join(" ");
        if (!whom || !message) {
          console.error("Usage: dms.ts send <club-id> <message>");
          process.exit(1);
        }
        if (isClub(whom)) {
          result = await sendClubMessage(whom, message);
        } else {
          console.error("error: 1:1 DM send is handled by the Tlon channel plugin.");
          console.error("Use the channel message tool with channel=tlon instead.");
          process.exit(1);
        }
        break;
      }

      case "reply": {
        const whom = args[1];
        const postId = args[2];
        const message = args.slice(3).join(" ");
        if (!whom || !postId || !message) {
          console.error("Usage: dms.ts reply <club-id> <post-id> <message>");
          process.exit(1);
        }
        if (isClub(whom)) {
          result = await replyToClub(whom, postId, message);
        } else {
          console.error("error: 1:1 DM reply is handled by the Tlon channel plugin.");
          console.error("Use the channel message tool with channel=tlon and replyTo instead.");
          process.exit(1);
        }
        break;
      }

      case "react": {
        const whom = args[1];
        const postId = args[2];
        const emoji = args[3];
        if (!whom || !postId || !emoji) {
          console.error("Usage: dms.ts react <ship> <post-id> <emoji>");
          console.error("Example: dms.ts react ~sampel-palnet ~zod/170.141.184.507... 👍");
          process.exit(1);
        }
        // Note: Club reactions would need different handling
        result = await reactToDM(whom, postId, emoji);
        break;
      }

      case "unreact": {
        const whom = args[1];
        const postId = args[2];
        if (!whom || !postId) {
          console.error("Usage: dms.ts unreact <ship> <post-id>");
          process.exit(1);
        }
        result = await unreactToDM(whom, postId);
        break;
      }

      case "delete": {
        const whom = args[1];
        const postId = args[2];
        if (!whom || !postId) {
          console.error("Usage: dms.ts delete <ship> <post-id>");
          process.exit(1);
        }
        result = await deleteDM(whom, postId);
        break;
      }

      case "accept": {
        const ship = args[1];
        if (!ship) {
          console.error("Usage: dms.ts accept <ship>");
          process.exit(1);
        }
        result = await acceptDM(ship);
        break;
      }

      case "decline": {
        const ship = args[1];
        if (!ship) {
          console.error("Usage: dms.ts decline <ship>");
          process.exit(1);
        }
        result = await declineDM(ship);
        break;
      }

      default:
        console.error(`
Usage: dms.ts <command> [args]

Note: 1:1 DM send/reply is handled by the Tlon channel plugin.
Use tlon-run only for club (group DM) send/reply and DM management ops.

Commands:
  send <club-id> <message>                   Send to group DM (club only)
  reply <club-id> <post-id> <message>        Reply in group DM (club only)
  react <ship> <post-id> <emoji>             React to a DM with an emoji
  unreact <ship> <post-id>                   Remove your reaction from a DM
  delete <ship> <post-id>                    Delete a DM
  accept <ship>                              Accept a DM invite
  decline <ship>                             Decline a DM invite

Club ID format: 0v... (for group DMs)
Post ID format: ~author/170.141.184.507...

Examples:
  dms.ts send 0v4.club-id "Hello group"
  dms.ts react ~sampel-palnet ~zod/170.141.184.507... ❤️
  dms.ts accept ~sampel-palnet
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
