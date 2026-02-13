#!/usr/bin/env npx ts-node
/**
 * Contacts management for Tlon/Urbit
 *
 * Usage:
 *   npx ts-node contacts.ts list                      # List all contacts
 *   npx ts-node contacts.ts get ~ship                 # Get a contact's profile
 *   npx ts-node contacts.ts update-profile [options]  # Update your profile
 */

import {
  getContacts,
  syncUserProfiles,
  updateContactMetadata,
  getCurrentUserId,
  poke,
} from "@tloncorp/api";
import type { Contact } from "@tloncorp/api";
import { ensureClient, normalizeShip } from "./api-client";

interface ContactEditField {
  nickname?: string;
  bio?: string;
  status?: string;
  avatar?: string;
  cover?: string;
}

// Helper to extract profile values
// Contact has both direct fields (nickname, avatarImage) and peer fields (peerNickname, peerAvatarImage)
function extractProfile(contact: Contact | null) {
  if (!contact) return null;
  return {
    nickname: contact.nickname ?? contact.peerNickname ?? null,
    bio: contact.bio ?? null,
    status: contact.status ?? null,
    avatar: contact.avatarImage ?? contact.peerAvatarImage ?? null,
    cover: contact.coverImage ?? null,
    color: contact.color ?? null,
  };
}

// List all contacts and peers
async function listContacts() {
  const contacts = await getContacts();

  return contacts.map((contact) => ({
    ship: contact.id,
    isContact: !!contact.isContact,
    profile: extractProfile(contact),
  }));
}

// Get a specific contact's profile
async function getContact(ship: string) {
  const normalizedShip = normalizeShip(ship);
  const contacts = await getContacts();
  const contact = contacts.find((c) => c.id === normalizedShip) || null;

  if (contact) {
    return {
      ship: normalizedShip,
      isContact: !!contact.isContact,
      profile: extractProfile(contact),
    };
  }

  return {
    ship: normalizedShip,
    isContact: false,
    profile: null,
    note: "Ship not in local contacts. Use 'sync' to fetch their profile.",
  };
}

// Sync (fetch) profiles for ships
async function syncProfiles(ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await syncUserProfiles(normalizedShips);
  return { synced: normalizedShips };
}

// Update current user's profile
async function updateProfile(updates: {
  nickname?: string | null;
  bio?: string;
  status?: string;
  avatar?: string | null;
  cover?: string;
}) {
  const editFields: ContactEditField[] = [];

  if (updates.nickname !== undefined) {
    editFields.push({ nickname: updates.nickname ?? "" });
  }
  if (updates.bio !== undefined) {
    editFields.push({ bio: updates.bio });
  }
  if (updates.status !== undefined) {
    editFields.push({ status: updates.status });
  }
  if (updates.avatar !== undefined) {
    editFields.push({ avatar: updates.avatar ?? "" });
  }
  if (updates.cover !== undefined) {
    editFields.push({ cover: updates.cover });
  }

  if (editFields.length === 0) {
    throw new Error("No profile fields to update");
  }

  await poke({
    app: "contacts",
    mark: "contact-action",
    json: { edit: editFields },
  });

  return { updated: Object.keys(updates), ship: getCurrentUserId() };
}

// Get own profile
async function getSelf() {
  const currentUserId = getCurrentUserId();
  const contacts = await getContacts();
  const contact = contacts.find((c) => c.id === currentUserId) || null;

  return {
    ship: currentUserId,
    profile: extractProfile(contact),
  };
}

// Add a contact
async function addContact(ship: string) {
  const normalizedShip = normalizeShip(ship);
  await poke({
    app: "contacts",
    mark: "contact-action-1",
    json: { page: { kip: normalizedShip, contact: {} } },
  });
  return { added: normalizedShip };
}

// Remove a contact
async function removeContact(ship: string) {
  const normalizedShip = normalizeShip(ship);
  await poke({
    app: "contacts",
    mark: "contact-action-1",
    json: { wipe: [normalizedShip] },
  });
  return { removed: normalizedShip };
}

// Update a contact's metadata (nickname/avatar)
async function updateContact(
  ship: string,
  updates: { nickname?: string; avatar?: string }
) {
  const normalizedShip = normalizeShip(ship);
  await updateContactMetadata(normalizedShip, {
    nickname: updates.nickname,
    avatarImage: updates.avatar,
  });
  return { updated: normalizedShip };
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    ensureClient();
    let result: any;

    switch (command) {
      case "list":
        result = await listContacts();
        break;

      case "self":
        result = await getSelf();
        break;

      case "get":
        if (!args[1]) {
          console.error("Usage: contacts.ts get ~ship");
          process.exit(1);
        }
        result = await getContact(args[1]);
        break;

      case "sync":
        if (!args[1]) {
          console.error("Usage: contacts.ts sync ~ship [~ship2 ...]");
          process.exit(1);
        }
        result = await syncProfiles(args.slice(1));
        break;

      case "add":
        if (!args[1]) {
          console.error("Usage: contacts.ts add ~ship");
          process.exit(1);
        }
        result = await addContact(args[1]);
        break;

      case "remove":
      case "del":
        if (!args[1]) {
          console.error("Usage: contacts.ts remove ~ship");
          process.exit(1);
        }
        result = await removeContact(args[1]);
        break;

      case "update": {
        const ship = args[1];
        if (!ship) {
          console.error("Usage: contacts.ts update ~ship [--nickname <name>] [--avatar <url>]");
          process.exit(1);
        }
        const nicknameIdx = args.indexOf("--nickname");
        const avatarIdx = args.indexOf("--avatar");
        const nickname = nicknameIdx !== -1 ? args[nicknameIdx + 1] : undefined;
        const avatar = avatarIdx !== -1 ? args[avatarIdx + 1] : undefined;
        result = await updateContact(ship, { nickname, avatar });
        break;
      }

      case "update-profile": {
        const nicknameIdx = args.indexOf("--nickname");
        const bioIdx = args.indexOf("--bio");
        const statusIdx = args.indexOf("--status");
        const avatarIdx = args.indexOf("--avatar");
        const coverIdx = args.indexOf("--cover");

        const updates = {
          nickname: nicknameIdx !== -1 ? args[nicknameIdx + 1] : undefined,
          bio: bioIdx !== -1 ? args[bioIdx + 1] : undefined,
          status: statusIdx !== -1 ? args[statusIdx + 1] : undefined,
          avatar: avatarIdx !== -1 ? args[avatarIdx + 1] : undefined,
          cover: coverIdx !== -1 ? args[coverIdx + 1] : undefined,
        };

        result = await updateProfile(updates);
        break;
      }

      default:
        console.log(`Usage: contacts.ts <command>

Commands:
  list                     List all contacts
  self                     Show your profile
  get ~ship                Get a contact's profile
  sync ~ship [~ship2 ...]   Sync profiles
  add ~ship                Add a contact
  remove ~ship             Remove a contact
  update ~ship --nickname <name> --avatar <url>
                           Update a contact's metadata
  update-profile [options] Update your profile

Examples:
  npx ts-node scripts/contacts.ts list
  npx ts-node scripts/contacts.ts get ~sampel-palnet
  npx ts-node scripts/contacts.ts update-profile --nickname "New Name"
`);
        process.exit(1);
    }

    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
