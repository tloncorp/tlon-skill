#!/usr/bin/env npx ts-node
/**
 * Direct Message operations for Tlon
 *
 * Usage:
 *   npx ts-node scripts/dms.ts send <ship> <message>
 *   npx ts-node scripts/dms.ts reply <ship> <post-id> <message>
 *   npx ts-node scripts/dms.ts react <ship> <post-id> <emoji>
 *   npx ts-node scripts/dms.ts unreact <ship> <post-id>
 *   npx ts-node scripts/dms.ts delete <ship> <post-id>
 *   npx ts-node scripts/dms.ts accept <ship>
 *   npx ts-node scripts/dms.ts decline <ship>
 *
 * For group DMs, use the club ID (0v format) instead of ship
 */

import { getConfig, poke, getCurrentShip, normalizeShip } from "./urbit-client";

// Parse content into Story format
function parseContent(message: string): any[] {
  const inlines: any[] = [];
  
  // Split by ship mentions
  const parts = message.split(/(~[a-z]+-[a-z]+(?:-[a-z]+)*)/g);
  
  for (const part of parts) {
    if (!part) continue;
    
    if (part.match(/^~[a-z]+-[a-z]+(?:-[a-z]+)*$/)) {
      inlines.push({ ship: part });
    } else {
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

// Check if the target is a group DM (club)
function isClub(whom: string): boolean {
  return whom.startsWith("0v");
}

// Send a DM to a ship
async function sendDM(
  ship: string,
  message: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const author = getCurrentShip();
  const sent = Date.now();
  const content = parseContent(message);

  const essay = {
    content,
    author,
    sent,
    kind: "/chat",
    blob: null,
    meta: null,
  };

  try {
    await poke({
      app: "chat",
      mark: "chat-dm-action-1",
      json: {
        ship: normalizedShip,
        diff: {
          id: `${author}/${sent}`,
          delta: {
            add: {
              essay,
              time: null,
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

// Send a message to a group DM (club)
async function sendClubMessage(
  clubId: string,
  message: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
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
      app: "chat",
      mark: "chat-club-action-0",
      json: {
        id: clubId,
        diff: {
          uid: "0v3",
          delta: {
            writ: {
              id: `${author}/${sent}`,
              delta: {
                add: {
                  essay: {
                    content,
                    author,
                    sent,
                    kind: "/chat",
                    blob: null,
                    meta: null,
                  },
                  time: null,
                },
              },
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

// Reply to a DM
async function replyToDM(
  ship: string,
  postId: string,
  message: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const normalizedShip = normalizeShip(ship);
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
      app: "chat",
      mark: "chat-dm-action-1",
      json: {
        ship: normalizedShip,
        diff: {
          id: postId,
          delta: {
            reply: {
              id: `${author}/${sent}`,
              meta: null,
              delta: {
                add: {
                  memo,
                  time: null,
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

// Reply in a club (group DM)
async function replyToClub(
  clubId: string,
  postId: string,
  message: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
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
                  id: `${author}/${sent}`,
                  meta: null,
                  delta: {
                    add: {
                      memo,
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

    return { success: true, replyId: `${author}/${sent}` };
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
      mark: "chat-dm-action-1",
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
          console.error("Usage: dms.ts send <ship|club-id> <message>");
          console.error("Example: dms.ts send ~sampel-palnet Hello!");
          process.exit(1);
        }
        if (isClub(whom)) {
          result = await sendClubMessage(whom, message);
        } else {
          result = await sendDM(whom, message);
        }
        break;
      }

      case "reply": {
        const whom = args[1];
        const postId = args[2];
        const message = args.slice(3).join(" ");
        if (!whom || !postId || !message) {
          console.error("Usage: dms.ts reply <ship|club-id> <post-id> <message>");
          process.exit(1);
        }
        if (isClub(whom)) {
          result = await replyToClub(whom, postId, message);
        } else {
          result = await replyToDM(whom, postId, message);
        }
        break;
      }

      case "react": {
        const whom = args[1];
        const postId = args[2];
        const emoji = args[3];
        if (!whom || !postId || !emoji) {
          console.error("Usage: dms.ts react <ship> <post-id> <emoji>");
          console.error("Example: dms.ts react ~sampel-palnet 1706123456789 👍");
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

Commands:
  send <ship|club-id> <message>              Send a DM
  reply <ship|club-id> <post-id> <message>   Reply to a DM
  react <ship> <post-id> <emoji>             React to a DM with an emoji
  unreact <ship> <post-id>                   Remove your reaction from a DM
  delete <ship> <post-id>                    Delete a DM
  accept <ship>                              Accept a DM invite
  decline <ship>                             Decline a DM invite

Ship format: ~sampel-palnet (with or without ~)
Club ID format: 0v... (for group DMs)

Examples:
  dms.ts send ~sampel-palnet "Hey, how's it going?"
  dms.ts react ~sampel-palnet 1706123456789 ❤️
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
