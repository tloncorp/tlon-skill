#!/usr/bin/env npx ts-node
/**
 * Contacts management for Tlon/Urbit
 *
 * Usage:
 *   npx ts-node contacts.ts list                      # List all contacts
 *   npx ts-node contacts.ts get ~ship                 # Get a contact's profile
 *   npx ts-node contacts.ts update-profile [options]  # Update your profile
 */

import { scry, poke, closeClient, normalizeShip, getCurrentShip } from "./urbit-client";

// Types from homestead shared/src/urbit/contact.ts
interface ContactFieldText {
  type: "text";
  value: string;
}

interface ContactImageField {
  type: "look";
  value: string;
}

interface ContactFieldColor {
  type: "tint";
  value: string;
}

interface ContactBookProfile {
  nickname?: ContactFieldText;
  bio?: ContactFieldText;
  avatar?: ContactImageField;
  cover?: ContactImageField;
  color?: ContactFieldColor;
  status?: ContactFieldText;
}

type ContactRolodex = Record<string, ContactBookProfile | null>;
type ContactBookScryResult = Record<string, [ContactBookProfile, ContactBookProfile | null]>;

interface ContactEditField {
  nickname?: string;
  bio?: string;
  status?: string;
  avatar?: string;
  cover?: string;
}

// Helper to extract profile values
function extractProfile(profile: ContactBookProfile | null) {
  if (!profile) return null;
  return {
    nickname: profile.nickname?.value || null,
    bio: profile.bio?.value || null,
    status: profile.status?.value || null,
    avatar: profile.avatar?.value || null,
    cover: profile.cover?.value || null,
    color: profile.color?.value || null,
  };
}

// List all contacts and peers
async function listContacts() {
  // Get all peers (merged profile data)
  const peers = await scry<ContactRolodex>({
    app: "contacts",
    path: "/all",
  });

  // Get contacts (with user overrides)
  const contacts = await scry<ContactBookScryResult>({
    app: "contacts",
    path: "/v1/book",
  });

  const result: any[] = [];

  // Add contacts first (they have override info)
  for (const [ship, entry] of Object.entries(contacts)) {
    if (!entry) continue;
    const [base, overrides] = entry;
    result.push({
      ship,
      isContact: true,
      profile: extractProfile(base),
      overrides: extractProfile(overrides),
    });
  }

  // Add peers that aren't contacts
  const contactShips = new Set(Object.keys(contacts));
  for (const [ship, profile] of Object.entries(peers)) {
    if (contactShips.has(ship)) continue;
    if (!profile) continue;
    result.push({
      ship,
      isContact: false,
      profile: extractProfile(profile as ContactBookProfile),
    });
  }

  return result;
}

// Get a specific contact's profile
async function getContact(ship: string) {
  const normalizedShip = normalizeShip(ship);

  // Try contacts book first
  const contacts = await scry<ContactBookScryResult>({
    app: "contacts",
    path: "/v1/book",
  });

  if (contacts[normalizedShip]) {
    const [base, overrides] = contacts[normalizedShip];
    return {
      ship: normalizedShip,
      isContact: true,
      profile: extractProfile(base),
      overrides: extractProfile(overrides),
    };
  }

  // Fall back to peers
  const peers = await scry<ContactRolodex>({
    app: "contacts",
    path: "/all",
  });

  const peerProfile = peers[normalizedShip];
  if (peerProfile) {
    return {
      ship: normalizedShip,
      isContact: false,
      profile: extractProfile(peerProfile as ContactBookProfile),
    };
  }

  // Ship not found in local data - try to sync
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
  await poke({
    app: "contacts",
    mark: "contact-action-1",
    json: { meet: normalizedShips },
  });
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

  return { updated: Object.keys(updates), ship: getCurrentShip() };
}

// Get own profile
async function getSelf() {
  const profile = await scry<ContactBookProfile>({
    app: "contacts",
    path: "/v1/self",
  });

  return {
    ship: getCurrentShip(),
    profile: extractProfile(profile),
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

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
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
          console.error("Usage: contacts.ts sync ~ship1 ~ship2 ...");
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
        if (!args[1]) {
          console.error("Usage: contacts.ts remove ~ship");
          process.exit(1);
        }
        result = await removeContact(args[1]);
        break;

      case "update-profile": {
        const updates: any = {};
        for (let i = 1; i < args.length; i += 2) {
          const flag = args[i];
          const value = args[i + 1];
          switch (flag) {
            case "--nickname":
              updates.nickname = value === "null" ? null : value;
              break;
            case "--bio":
              updates.bio = value;
              break;
            case "--status":
              updates.status = value;
              break;
            case "--avatar":
              updates.avatar = value === "null" ? null : value;
              break;
            case "--cover":
              updates.cover = value;
              break;
            default:
              console.error(`Unknown flag: ${flag}`);
              process.exit(1);
          }
        }
        result = await updateProfile(updates);
        break;
      }

      default:
        console.error(`
Usage: contacts.ts <command> [args]

Commands:
  list                          List all contacts and peers
  self                          Get your own profile
  get <~ship>                   Get a contact's profile
  sync <~ship> [~ship...]       Fetch/sync profiles from ships
  add <~ship>                   Add a ship as a contact
  remove <~ship>                Remove a contact
  update-profile [options]      Update your profile
    --nickname <name|null>
    --bio <text>
    --status <text>
    --avatar <url|null>
    --cover <url>
`);
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await closeClient();
  }
}

main();
