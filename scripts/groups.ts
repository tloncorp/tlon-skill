#!/usr/bin/env npx ts-node
/**
 * Groups API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/groups.ts list
 *   npx ts-node scripts/groups.ts create "Group Name" [--description "..."]
 *   npx ts-node scripts/groups.ts invite <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts info <group-id>
 *   npx ts-node scripts/groups.ts leave <group-id>
 *   npx ts-node scripts/groups.ts join <group-id>
 *   npx ts-node scripts/groups.ts delete <group-id>
 *   npx ts-node scripts/groups.ts update <group-id> --title "..." [--description "..."] [--image "..."]
 *   npx ts-node scripts/groups.ts kick <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts ban <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts unban <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts add-role <group-id> <role-id> --title "..." [--description "..."]
 *   npx ts-node scripts/groups.ts delete-role <group-id> <role-id>
 *   npx ts-node scripts/groups.ts update-role <group-id> <role-id> --title "..." [--description "..."]
 *   npx ts-node scripts/groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts set-privacy <group-id> <public|private|secret>
 *   npx ts-node scripts/groups.ts accept-join <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts reject-join <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts promote <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts demote <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]
 */

import {
  acceptGroupJoin,
  addGroupRole,
  addMembersToRole,
  banUsersFromGroup,
  createChannel,
  createGroup,
  deleteGroup,
  deleteGroupRole,
  getContacts,
  getCurrentUserId,
  getGroup,
  getGroups,
  inviteGroupMembers,
  kickUsersFromGroup,
  leaveGroup,
  poke,
  rejectGroupJoin,
  removeMembersFromRole,
  requestGroupInvitation,
  unbanUsersFromGroup,
  updateGroupMeta,
  updateGroupPrivacy,
  updateGroupRole,
} from "@tloncorp/api";
import type { Group } from "@tloncorp/api";
import { ensureClient, getCurrentShip, normalizeShip } from "./api-client";
import { getOption } from "./cli-utils";

// Generate a random short ID for the group
function generateGroupSlug(): string {
  // Must be valid @tas: lowercase letters, numbers, hyphens, must start with letter
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 7; i++) {
    slug += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }
  return slug;
}

// List all groups
async function listGroups() {
  const groups = await getGroups();

  console.log("\n=== YOUR GROUPS ===\n");

  for (const group of groups) {
    const memberCount = group.memberCount ?? (group.members || []).length;
    const channelCount = (group.channels || []).length;
    const privacy = group.privacy || "unknown";

    console.log(`📁 ${group.title || group.id}`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Privacy: ${privacy}`);
    console.log(`   Members: ${memberCount}, Channels: ${channelCount}`);
    if (group.description) {
      console.log(`   Description: ${group.description}`);
    }
    console.log("");
  }
}

// Build a map of ship -> nickname from contacts
async function buildNicknameMap(): Promise<Map<string, string>> {
  const nicknameMap = new Map<string, string>();
  try {
    const contacts = await getContacts();
    for (const contact of contacts) {
      const nickname = contact.nickname ?? contact.peerNickname;
      if (nickname) {
        nicknameMap.set(contact.id, nickname);
      }
    }
  } catch {
    // Contacts unavailable, continue without nicknames
  }
  return nicknameMap;
}

// Format a ship with optional nickname
function formatShipWithNickname(ship: string, nicknameMap: Map<string, string>): string {
  const nickname = nicknameMap.get(ship);
  return nickname ? `${ship} (${nickname})` : ship;
}

// Get info about a specific group
async function getGroupInfo(groupId: string) {
  const [group, nicknameMap] = await Promise.all([
    getGroup(groupId),
    buildNicknameMap(),
  ]);

  console.log(`\n=== ${group.title || groupId} ===\n`);
  console.log(`ID: ${groupId}`);
  console.log(`Privacy: ${group.privacy || "unknown"}`);
  console.log(`Description: ${group.description || "(none)"}`);

  if (group.iconImage) {
    console.log(`Icon: ${group.iconImage}`);
  }

  console.log("\n--- Members ---");
  for (const member of group.members || []) {
    const roles = (member.roles || []).map((r) => r.roleId);
    const roleList = roles.length > 0 ? ` [${roles.join(", ")}]` : "";
    const displayName = formatShipWithNickname(member.contactId, nicknameMap);
    console.log(`  ${displayName}${roleList}`);
  }

  if (group.roles && group.roles.length > 0) {
    console.log("\n--- Roles ---");
    for (const role of group.roles) {
      console.log(`  ${role.id}: ${role.title || "(untitled)"}`);
    }
  }

  if (group.channels && group.channels.length > 0) {
    console.log("\n--- Channels ---");
    for (const channel of group.channels) {
      const title = channel.title || channel.id;
      console.log(`  ${title} (${channel.id})`);
    }
  }

  if (group.pendingMembers && group.pendingMembers.length > 0) {
    console.log("\n--- Pending Invites ---");
    for (const member of group.pendingMembers) {
      console.log(`  ${formatShipWithNickname(member.contactId, nicknameMap)}`);
    }
  }

  if (group.joinRequests && group.joinRequests.length > 0) {
    console.log("\n--- Join Requests ---");
    for (const request of group.joinRequests) {
      console.log(`  ${formatShipWithNickname(request.contactId, nicknameMap)}`);
    }
  }

  if (group.bannedMembers && group.bannedMembers.length > 0) {
    console.log("\n--- Banned Ships ---");
    for (const ban of group.bannedMembers) {
      console.log(`  ${formatShipWithNickname(ban.contactId, nicknameMap)}`);
    }
  }
}

// Create a new group
async function createGroupWithChannel(title: string, description: string = "") {
  const ship = await getCurrentShip();
  const slug = generateGroupSlug();
  const groupId = `${ship}/${slug}`;
  const channelSlug = `${slug}-general`;
  const channelId = `chat/${ship}/${channelSlug}`;

  console.log(`Creating group "${title}" with ID: ${groupId}...`);

  const group: Group = {
    id: groupId,
    title,
    description,
    hostUserId: getCurrentUserId(),
    currentUserIsHost: true,
    currentUserIsMember: true,
    channels: [
      {
        id: channelId,
        title: "General",
        description: "General chat",
        type: "chat",
        groupId,
      },
    ],
  };

  await createGroup({
    group,
  });

  console.log(`✅ Group created successfully!`);
  console.log(`   ID: ${groupId}`);
  console.log(`   Title: ${title}`);
  console.log(`   Channel: ${channelId}`);

  return groupId;
}

// Invite ships to a group
async function inviteToGroup(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Inviting ${normalizedShips.join(", ")} to ${groupId}...`);

  await inviteGroupMembers({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Invitations sent!`);
}

// Leave a group
async function leaveGroupById(groupId: string) {
  console.log(`Leaving group ${groupId}...`);

  await leaveGroup(groupId);

  console.log(`✅ Left group.`);
}

// Join a group
async function joinGroupById(groupId: string) {
  console.log(`Joining group ${groupId}...`);

  await requestGroupInvitation(groupId);

  console.log(`✅ Join request sent! (May need approval if group is private)`);
}

// Delete a group (must be host)
async function deleteGroupById(groupId: string) {
  console.log(`Deleting group ${groupId}...`);

  await deleteGroup(groupId);

  console.log(`✅ Group deleted.`);
}

// Update group metadata
async function updateGroup(
  groupId: string,
  options: { title?: string; description?: string; image?: string; cover?: string }
) {
  const group = await getGroup(groupId);

  const meta = {
    title: options.title ?? group.title ?? "",
    description: options.description ?? group.description ?? "",
    image: options.image ?? group.iconImage ?? "",
    cover: options.cover ?? group.coverImage ?? "",
  };

  console.log(`Updating group ${groupId}...`);

  await updateGroupMeta({
    groupId,
    meta,
  });

  console.log(`✅ Group updated.`);
  console.log(`   Title: ${meta.title}`);
  console.log(`   Description: ${meta.description || "(none)"}`);
}

// Kick members from a group
async function kickMembers(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Kicking ${normalizedShips.join(", ")} from ${groupId}...`);

  await kickUsersFromGroup({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Members kicked.`);
}

// Ban members from a group
async function banMembers(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Banning ${normalizedShips.join(", ")} from ${groupId}...`);

  await banUsersFromGroup({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Members banned.`);
}

// Unban members from a group
async function unbanMembers(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Unbanning ${normalizedShips.join(", ")} from ${groupId}...`);

  await unbanUsersFromGroup({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Members unbanned.`);
}

// Add a role to a group
async function addRole(
  groupId: string,
  roleId: string,
  options: { title?: string; description?: string }
) {
  const title = options.title || roleId;
  const description = options.description || "";

  console.log(`Adding role "${roleId}" to ${groupId}...`);

  await addGroupRole({
    groupId,
    roleId,
    meta: { title, description },
  });

  console.log(`✅ Role "${roleId}" added.`);
  console.log(`   Title: ${title}`);
}

// Delete a role from a group
async function deleteRole(groupId: string, roleId: string) {
  console.log(`Deleting role "${roleId}" from ${groupId}...`);

  await deleteGroupRole({ groupId, roleId });

  console.log(`✅ Role "${roleId}" deleted.`);
}

// Update a role's metadata
async function updateRole(
  groupId: string,
  roleId: string,
  options: { title?: string; description?: string }
) {
  const group = await getGroup(groupId);
  const currentRole = (group.roles || []).find((role) => role.id === roleId);
  if (!currentRole) {
    throw new Error(`Role "${roleId}" not found in group ${groupId}`);
  }

  const meta = {
    title: options.title ?? currentRole.title ?? "",
    description: options.description ?? currentRole.description ?? "",
  };

  console.log(`Updating role "${roleId}" in ${groupId}...`);

  await updateGroupRole({ groupId, roleId, meta });

  console.log(`✅ Role "${roleId}" updated.`);
  console.log(`   Title: ${meta.title}`);
}

// Assign a role to members
async function assignRole(groupId: string, roleId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(
    `Assigning role "${roleId}" to ${normalizedShips.join(", ")} in ${groupId}...`
  );

  await addMembersToRole({
    groupId,
    roleId,
    ships: normalizedShips,
  });

  console.log(`✅ Role assigned.`);
}

// Remove a role from members
async function removeRole(groupId: string, roleId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(
    `Removing role "${roleId}" from ${normalizedShips.join(", ")} in ${groupId}...`
  );

  await removeMembersFromRole({
    groupId,
    roleId,
    ships: normalizedShips,
  });

  console.log(`✅ Role removed.`);
}

// Update group privacy
async function setGroupPrivacy(groupId: string, privacy: "public" | "private" | "secret") {
  const group = await getGroup(groupId);
  const oldPrivacy = (group.privacy ?? "private") as "public" | "private" | "secret";

  console.log(`Updating privacy for ${groupId} to ${privacy}...`);

  await updateGroupPrivacy({
    groupId,
    oldPrivacy,
    newPrivacy: privacy,
  });

  console.log(`✅ Privacy updated.`);
}

// Accept join requests
async function acceptJoin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Accepting join requests for ${normalizedShips.join(", ")}...`);

  await acceptGroupJoin({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Join requests accepted.`);
}

// Reject join requests
async function rejectJoin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Rejecting join requests for ${normalizedShips.join(", ")}...`);

  await rejectGroupJoin({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Join requests rejected.`);
}

// Add a channel to an existing group
async function addChannel(
  groupId: string,
  title: string,
  kind: "chat" | "diary" | "heap" = "chat",
  description: string = ""
) {
  const ship = await getCurrentShip();
  const slug = generateGroupSlug();
  const name = slug;
  const nest = `${kind}/${ship}/${name}`;

  console.log(`Adding channel "${title}" to group ${groupId}...`);

  await createChannel({
    id: nest,
    kind,
    group: groupId,
    name,
    title,
    description,
    meta: null,
    readers: [],
    writers: [],
  });

  console.log(`✅ Channel created!`);
  console.log(`   Nest: ${nest}`);
  console.log(`   Title: ${title}`);
  console.log(`   Group: ${groupId}`);
  return nest;
}

// Promote a member to admin by assigning them an admin role
async function promoteMemberToAdmin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  const group = await getGroup(groupId);

  // Find or create an admin role
  const adminRole = (group.roles || []).find((r) => r.id === "admin");

  if (!adminRole) {
    // Create an "admin" role and make it admin
    console.log(`Creating "admin" role in ${groupId}...`);
    await addGroupRole({
      groupId,
      roleId: "admin",
      meta: { title: "Admin", description: "Group administrator" },
    });
    await poke({
      app: "groups",
      mark: "group-action-4",
      json: {
        group: {
          flag: groupId,
          "a-group": {
            role: {
              roles: ["admin"],
              "a-role": {
                "set-admin": null,
              },
            },
          },
        },
      },
    });
  }

  console.log(`Promoting ${normalizedShips.join(", ")} to admin in ${groupId}...`);

  await addMembersToRole({
    groupId,
    roleId: "admin",
    ships: normalizedShips,
  });

  console.log(`✅ Members promoted to admin.`);
}

// Demote a member from admin by removing them from admin roles
async function demoteMemberFromAdmin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  const group = await getGroup(groupId);

  // Find all admin roles this member might have
  // For now, check the "admin" role
  const adminRoles = (group.roles || []).filter((r) => {
    // We can't easily tell which roles are admin from the group info alone,
    // so we target the "admin" role specifically
    return r.id === "admin";
  });

  if (adminRoles.length === 0) {
    console.error(`No "admin" role found in ${groupId}.`);
    process.exit(1);
  }

  for (const role of adminRoles) {
    console.log(`Removing "${role.id}" role from ${normalizedShips.join(", ")}...`);
    await removeMembersFromRole({
      groupId,
      roleId: role.id,
      ships: normalizedShips,
    });
  }

  console.log(`✅ Members demoted from admin.`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await ensureClient(['groups', 'channels']);

  switch (command) {
    case "list":
      await listGroups();
      break;

    case "create": {
      const title = args[1];
      if (!title) {
        console.error('Usage: groups.ts create "Group Name" [--description "..."]');
        process.exit(1);
      }
      const description = getOption(args, "description") || "";
      await createGroupWithChannel(title, description);
      break;
    }

    case "invite": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts invite <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await inviteToGroup(groupId, ships);
      break;
    }

    case "info": {
      const groupId = args[1];
      if (!groupId) {
        console.error("Usage: groups.ts info <group-id>");
        process.exit(1);
      }
      await getGroupInfo(groupId);
      break;
    }

    case "leave": {
      const groupId = args[1];
      if (!groupId) {
        console.error("Usage: groups.ts leave <group-id>");
        process.exit(1);
      }
      await leaveGroupById(groupId);
      break;
    }

    case "join": {
      const groupId = args[1];
      if (!groupId) {
        console.error("Usage: groups.ts join <group-id>");
        process.exit(1);
      }
      await joinGroupById(groupId);
      break;
    }

    case "delete": {
      const groupId = args[1];
      if (!groupId) {
        console.error("Usage: groups.ts delete <group-id>");
        process.exit(1);
      }
      await deleteGroupById(groupId);
      break;
    }

    case "update": {
      const groupId = args[1];
      if (!groupId) {
        console.error(
          'Usage: groups.ts update <group-id> --title "..." [--description "..."] [--image "..."]'
        );
        process.exit(1);
      }
      const title = getOption(args, "title");
      const description = getOption(args, "description");
      const image = getOption(args, "image");
      const cover = getOption(args, "cover");
      await updateGroup(groupId, { title, description, image, cover });
      break;
    }

    case "kick": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts kick <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await kickMembers(groupId, ships);
      break;
    }

    case "ban": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts ban <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await banMembers(groupId, ships);
      break;
    }

    case "unban": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts unban <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await unbanMembers(groupId, ships);
      break;
    }

    case "add-role": {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        console.error(
          'Usage: groups.ts add-role <group-id> <role-id> --title "..." [--description "..."]'
        );
        process.exit(1);
      }
      const title = getOption(args, "title");
      const description = getOption(args, "description");
      await addRole(groupId, roleId, { title, description });
      break;
    }

    case "delete-role": {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        console.error("Usage: groups.ts delete-role <group-id> <role-id>");
        process.exit(1);
      }
      await deleteRole(groupId, roleId);
      break;
    }

    case "update-role": {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        console.error(
          'Usage: groups.ts update-role <group-id> <role-id> --title "..." [--description "..."]'
        );
        process.exit(1);
      }
      const title = getOption(args, "title");
      const description = getOption(args, "description");
      await updateRole(groupId, roleId, { title, description });
      break;
    }

    case "assign-role": {
      const groupId = args[1];
      const roleId = args[2];
      const ships = args.slice(3);
      if (!groupId || !roleId || ships.length === 0) {
        console.error(
          "Usage: groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]"
        );
        process.exit(1);
      }
      await assignRole(groupId, roleId, ships);
      break;
    }

    case "remove-role": {
      const groupId = args[1];
      const roleId = args[2];
      const ships = args.slice(3);
      if (!groupId || !roleId || ships.length === 0) {
        console.error(
          "Usage: groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]"
        );
        process.exit(1);
      }
      await removeRole(groupId, roleId, ships);
      break;
    }

    case "set-privacy": {
      const groupId = args[1];
      const privacy = args[2] as "public" | "private" | "secret";
      if (!groupId || !privacy || !["public", "private", "secret"].includes(privacy)) {
        console.error("Usage: groups.ts set-privacy <group-id> <public|private|secret>");
        process.exit(1);
      }
      await setGroupPrivacy(groupId, privacy);
      break;
    }

    case "accept-join": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts accept-join <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await acceptJoin(groupId, ships);
      break;
    }

    case "reject-join": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts reject-join <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await rejectJoin(groupId, ships);
      break;
    }

    case "promote": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts promote <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await promoteMemberToAdmin(groupId, ships);
      break;
    }

    case "demote": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error("Usage: groups.ts demote <group-id> <ship> [<ship2> ...]");
        process.exit(1);
      }
      await demoteMemberFromAdmin(groupId, ships);
      break;
    }

    case "add-channel": {
      const groupId = args[1];
      const title = args[2];
      if (!groupId || !title) {
        console.error(
          'Usage: groups.ts add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]'
        );
        process.exit(1);
      }
      const kind = (getOption(args, "kind") as "chat" | "diary" | "heap") || "chat";
      const description = getOption(args, "description") || "";
      await addChannel(groupId, title, kind, description);
      break;
    }

    default:
      console.log(`Usage: groups.ts <command>

Commands:
  list
  create
  invite
  info
  leave
  join
  delete
  update
  kick
  ban
  unban
  add-role
  delete-role
  update-role
  assign-role
  remove-role
  set-privacy
  accept-join
  reject-join
  promote
  demote
  add-channel
`);
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
