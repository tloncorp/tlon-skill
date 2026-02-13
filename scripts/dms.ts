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

import {
  addReaction,
  deletePost,
  getCurrentUserId,
  removeReaction,
  respondToDMInvite,
  sendPost,
  sendReply,
} from "@tloncorp/api";
import type { Channel } from "@tloncorp/api";
import { ensureClient, normalizeShip } from "./api-client";
import { markdownToStory, type Story } from "./story";

// Parse content into Story format with rich markdown support
function parseContent(message: string): Story {
  return markdownToStory(message);
}

// Check if the target is a group DM (club)
function isClub(whom: string): boolean {
  return whom.startsWith("0v");
}

function parsePostId(postId: string): { id: string; authorId?: string } {
  if (postId.includes("/")) {
    const [author, id] = postId.split("/");
    return { id, authorId: normalizeShip(author) };
  }
  return { id: postId };
}

// Send a message to a group DM (club)
async function sendClubMessage(
  clubId: string,
  message: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const authorId = getCurrentUserId();
  const sentAt = Date.now();
  const content = parseContent(message);

  try {
    await sendPost({
      channelId: clubId,
      authorId,
      sentAt,
      content,
    });

    return { success: true };
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
  const authorId = getCurrentUserId();
  const sentAt = Date.now();
  const content = parseContent(message);
  const parsed = parsePostId(postId);

  if (!parsed.authorId) {
    return { success: false, error: "Post ID must include author (e.g., ~ship/123.456)" };
  }

  try {
    await sendReply({
      channelId: clubId,
      parentId: parsed.id,
      parentAuthor: parsed.authorId,
      content,
      sentAt,
      authorId,
    });

    return { success: true };
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
  const our = getCurrentUserId();
  const parsed = parsePostId(postId);

  if (!parsed.authorId) {
    return { success: false, error: "Post ID must include author (e.g., ~ship/123.456)" };
  }

  try {
    await addReaction({
      channelId: normalizedShip,
      postId: parsed.id,
      emoji: react,
      our,
      postAuthor: parsed.authorId,
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
  const our = getCurrentUserId();
  const parsed = parsePostId(postId);

  if (!parsed.authorId) {
    return { success: false, error: "Post ID must include author (e.g., ~ship/123.456)" };
  }

  try {
    await removeReaction({
      channelId: normalizedShip,
      postId: parsed.id,
      our,
      postAuthor: parsed.authorId,
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
  const authorId = getCurrentUserId();
  const parsed = parsePostId(postId);

  try {
    await deletePost(normalizedShip, parsed.id, parsed.authorId ?? authorId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Accept a DM invite
async function acceptDM(ship: string): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const channel: Channel = {
    id: normalizedShip,
    type: "dm",
    currentUserIsMember: false,
    currentUserIsHost: false,
    contactId: normalizedShip,
  };

  try {
    await respondToDMInvite({ channel, accept: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Decline a DM invite
async function declineDM(ship: string): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const channel: Channel = {
    id: normalizedShip,
    type: "dm",
    currentUserIsMember: false,
    currentUserIsHost: false,
    contactId: normalizedShip,
  };

  try {
    await respondToDMInvite({ channel, accept: false });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  ensureClient();

  switch (command) {
    case "send": {
      const clubId = args[1];
      const message = args.slice(2).join(" ");
      if (!clubId || !message) {
        console.error("Usage: dms.ts send <club-id> <message>");
        process.exit(1);
      }
      if (!isClub(clubId)) {
        console.error("Error: send only supports group DMs (club IDs starting with 0v)");
        process.exit(1);
      }
      const result = await sendClubMessage(clubId, message);
      if (result.success) {
        console.log("✓ Message sent!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "reply": {
      const clubId = args[1];
      const postId = args[2];
      const message = args.slice(3).join(" ");
      if (!clubId || !postId || !message) {
        console.error("Usage: dms.ts reply <club-id> <post-id> <message>");
        process.exit(1);
      }
      if (!isClub(clubId)) {
        console.error("Error: reply only supports group DMs (club IDs starting with 0v)");
        process.exit(1);
      }
      const result = await replyToClub(clubId, postId, message);
      if (result.success) {
        console.log("✓ Reply sent!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "react": {
      const ship = args[1];
      const postId = args[2];
      const react = args[3];
      if (!ship || !postId || !react) {
        console.error("Usage: dms.ts react <ship> <post-id> <emoji>");
        process.exit(1);
      }
      const result = await reactToDM(ship, postId, react);
      if (result.success) {
        console.log("✓ Reaction added!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "unreact": {
      const ship = args[1];
      const postId = args[2];
      if (!ship || !postId) {
        console.error("Usage: dms.ts unreact <ship> <post-id>");
        process.exit(1);
      }
      const result = await unreactToDM(ship, postId);
      if (result.success) {
        console.log("✓ Reaction removed!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "delete": {
      const ship = args[1];
      const postId = args[2];
      if (!ship || !postId) {
        console.error("Usage: dms.ts delete <ship> <post-id>");
        process.exit(1);
      }
      const result = await deleteDM(ship, postId);
      if (result.success) {
        console.log("✓ DM deleted!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "accept": {
      const ship = args[1];
      if (!ship) {
        console.error("Usage: dms.ts accept <ship>");
        process.exit(1);
      }
      const result = await acceptDM(ship);
      if (result.success) {
        console.log("✓ DM invite accepted!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case "decline": {
      const ship = args[1];
      if (!ship) {
        console.error("Usage: dms.ts decline <ship>");
        process.exit(1);
      }
      const result = await declineDM(ship);
      if (result.success) {
        console.log("✓ DM invite declined!");
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.log(`Usage: dms.ts <command>

Commands:
  send <club-id> <message>        Send a message to a group DM
  reply <club-id> <post-id> <msg> Reply in a group DM (post-id must include author)
  react <ship> <post-id> <emoji>  React to a DM (post-id must include author)
  unreact <ship> <post-id>        Remove reaction from a DM (post-id must include author)
  delete <ship> <post-id>         Delete a DM (post-id may include author)
  accept <ship>                   Accept a DM invite
  decline <ship>                  Decline a DM invite
`);
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
