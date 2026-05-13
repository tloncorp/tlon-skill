#!/usr/bin/env npx ts-node
/**
 * Groups API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/groups.ts list
 *   npx ts-node scripts/groups.ts create "Group Name" [--description "..."]
 *   npx ts-node scripts/groups.ts create-owned "Group Name" --owner <ship> [--description "..."]
 *   npx ts-node scripts/groups.ts invite <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts info <group-id>
 *   npx ts-node scripts/groups.ts leave <group-id>
 *   npx ts-node scripts/groups.ts join <group-id>
 *   npx ts-node scripts/groups.ts request-invite <group-id>
 *   npx ts-node scripts/groups.ts accept-invite <group-id>
 *   npx ts-node scripts/groups.ts reject-invite <group-id>
 *   npx ts-node scripts/groups.ts cancel-join <group-id>
 *   npx ts-node scripts/groups.ts rescind-request <group-id>
 *   npx ts-node scripts/groups.ts revoke-invite <group-id> <ship> [<ship2> ...]
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
  cancelGroupJoin as apiCancelGroupJoin,
  createChannel,
  createGroup,
  deleteGroup,
  deleteGroupRole,
  getContacts,
  getCurrentUserId,
  getGroup,
  getGroupPreview,
  getGroups,
  inviteGroupMembers,
  joinGroup as apiJoinGroup,
  kickUsersFromGroup,
  leaveGroup,
  poke,
  rejectGroupInvitation,
  rejectGroupJoin,
  removeMembersFromRole,
  requestGroupInvitation,
  rescindGroupInvitationRequest,
  revokeGroupMemberInvites,
  scry,
  toClientGroupsFromForeigns,
  unbanUsersFromGroup,
  updateGroupMeta,
  updateGroupPrivacy,
  updateGroupRole,
} from "@tloncorp/api";
import type { Group } from "@tloncorp/api";
import { ensureClient, getCurrentShip, normalizeShip } from "./api-client";
import { getOption, looksLikePositionalChannelKind, wantsHelp } from "./cli-utils";

const ADMIN_ROLE_ID = "admin";

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

const GROUPS_HELP = `Usage: groups.ts <command>

Commands:
  list
  create "Group Name" [--description "..."]
  create-owned "Group Name" --owner <ship> [--description "..."]
  invite <group-id> <ship> [<ship2> ...]
  info <group-id>
  leave <group-id>
  join <group-id>
  request-invite <group-id>
  accept-invite <group-id>
  reject-invite <group-id>
  cancel-join <group-id>
  rescind-request <group-id>
  revoke-invite <group-id> <ship> [<ship2> ...]
  delete <group-id>
  update <group-id> --title "..." [--description "..."] [--image "..."] [--cover "..."]
  kick <group-id> <ship> [<ship2> ...]
  ban <group-id> <ship> [<ship2> ...]
  unban <group-id> <ship> [<ship2> ...]
  add-role <group-id> <role-id> --title "..." [--description "..."]
  delete-role <group-id> <role-id>
  update-role <group-id> <role-id> --title "..." [--description "..."]
  assign-role <group-id> <role-id> <ship> [<ship2> ...]
  remove-role <group-id> <role-id> <ship> [<ship2> ...]
  set-privacy <group-id> <public|private|secret>
  accept-join <group-id> <ship> [<ship2> ...]
  reject-join <group-id> <ship> [<ship2> ...]
  promote <group-id> <ship> [<ship2> ...]
  demote <group-id> <ship> [<ship2> ...]
  add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]

Examples:
  groups.ts info ~host/group-slug
  groups.ts add-channel ~host/group-slug "Projects" --kind chat`;

const GROUPS_COMMAND_HELP: Record<string, string> = {
  list: `Usage: groups.ts list`,
  create: `Usage: groups.ts create "Group Name" [--description "..."]\nExample: groups.ts create "Projects" --description "Shared work"`,
  "create-owned": `Usage: groups.ts create-owned "Group Name" --owner <ship> [--description "..."]\nExample: groups.ts create-owned "Projects" --owner ~nec --description "Shared work"`,
  invite: `Usage: groups.ts invite <group-id> <ship> [<ship2> ...]\nExample: groups.ts invite ~host/group-slug ~nec ~bud`,
  info: `Usage: groups.ts info <group-id>\nExample: groups.ts info ~host/group-slug`,
  leave: `Usage: groups.ts leave <group-id>\nExample: groups.ts leave ~host/group-slug`,
  join: `Usage: groups.ts join <group-id>\nJoins public or invited groups. For private groups without an invite, requests an invite.\nExample: groups.ts join ~host/group-slug`,
  "request-invite": `Usage: groups.ts request-invite <group-id>\nExample: groups.ts request-invite ~host/group-slug`,
  "accept-invite": `Usage: groups.ts accept-invite <group-id>\nExample: groups.ts accept-invite ~host/group-slug`,
  "reject-invite": `Usage: groups.ts reject-invite <group-id>\nExample: groups.ts reject-invite ~host/group-slug`,
  "cancel-join": `Usage: groups.ts cancel-join <group-id>\nExample: groups.ts cancel-join ~host/group-slug`,
  "rescind-request": `Usage: groups.ts rescind-request <group-id>\nExample: groups.ts rescind-request ~host/group-slug`,
  "revoke-invite": `Usage: groups.ts revoke-invite <group-id> <ship> [<ship2> ...]\nExample: groups.ts revoke-invite ~host/group-slug ~nec`,
  delete: `Usage: groups.ts delete <group-id>\nExample: groups.ts delete ~host/group-slug`,
  update: `Usage: groups.ts update <group-id> --title "..." [--description "..."] [--image "..."] [--cover "..."]\nExample: groups.ts update ~host/group-slug --title "New Title"`,
  kick: `Usage: groups.ts kick <group-id> <ship> [<ship2> ...]\nExample: groups.ts kick ~host/group-slug ~nec`,
  ban: `Usage: groups.ts ban <group-id> <ship> [<ship2> ...]\nExample: groups.ts ban ~host/group-slug ~nec`,
  unban: `Usage: groups.ts unban <group-id> <ship> [<ship2> ...]\nExample: groups.ts unban ~host/group-slug ~nec`,
  "add-role": `Usage: groups.ts add-role <group-id> <role-id> --title "..." [--description "..."]\nExample: groups.ts add-role ~host/group-slug editors --title "Editors"`,
  "delete-role": `Usage: groups.ts delete-role <group-id> <role-id>\nExample: groups.ts delete-role ~host/group-slug editors`,
  "update-role": `Usage: groups.ts update-role <group-id> <role-id> --title "..." [--description "..."]\nExample: groups.ts update-role ~host/group-slug editors --title "Writers"`,
  "assign-role": `Usage: groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]\nExample: groups.ts assign-role ~host/group-slug editors ~nec`,
  "remove-role": `Usage: groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]\nExample: groups.ts remove-role ~host/group-slug editors ~nec`,
  "set-privacy": `Usage: groups.ts set-privacy <group-id> <public|private|secret>\nExample: groups.ts set-privacy ~host/group-slug private`,
  "accept-join": `Usage: groups.ts accept-join <group-id> <ship> [<ship2> ...]\nExample: groups.ts accept-join ~host/group-slug ~nec`,
  "reject-join": `Usage: groups.ts reject-join <group-id> <ship> [<ship2> ...]\nExample: groups.ts reject-join ~host/group-slug ~nec`,
  promote: `Usage: groups.ts promote <group-id> <ship> [<ship2> ...]\nExample: groups.ts promote ~host/group-slug ~nec`,
  demote: `Usage: groups.ts demote <group-id> <ship> [<ship2> ...]\nExample: groups.ts demote ~host/group-slug ~nec`,
  "add-channel": `Usage: groups.ts add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]\nExample: groups.ts add-channel ~host/group-slug "Projects" --kind chat`,
};

function printGroupsHelp(command?: string) {
  console.log(command ? GROUPS_COMMAND_HELP[command] ?? GROUPS_HELP : GROUPS_HELP);
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

type CreatedGroup = {
  groupId: string;
  channelId: string;
  group: Group;
};

type CreateGroupWithChannelOptions = {
  memberIds?: string[];
};

type OwnerAdminVerification =
  | { status: "verified" }
  | { status: "missing"; reason: string };

type RawGroupForAdminVerification = {
  admins?: string[];
  seats?: Record<string, { roles?: string[] }>;
  admissions?: {
    pending?: Record<string, string[]>;
    invited?: Record<string, unknown>;
  };
};

const VERIFY_ATTEMPTS = 5;
const VERIFY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function groupHasRole(group: Group, roleId: string): boolean {
  return (group.roles || []).some((role) => role.id === roleId);
}

function getShipRecordValue<T>(record: Record<string, T> | undefined, ship: string): T | undefined {
  if (!record) {
    return undefined;
  }

  const direct = record[ship];
  if (direct !== undefined) {
    return direct;
  }

  return Object.entries(record).find(([key]) => normalizeShip(key) === ship)?.[1];
}

async function getRawGroupForAdminVerification(
  groupId: string
): Promise<RawGroupForAdminVerification> {
  return scry<RawGroupForAdminVerification>({
    app: "groups",
    path: `/v2/ui/groups/${groupId}`,
  });
}

function hasOwnerSeat(rawGroup: RawGroupForAdminVerification, ownerShip: string): boolean {
  return getShipRecordValue(rawGroup.seats, ownerShip) !== undefined;
}

async function getRawGroupWithOwnerSeat(
  groupId: string,
  ownerShip: string
): Promise<RawGroupForAdminVerification> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawGroup = await getRawGroupForAdminVerification(groupId);
      if (hasOwnerSeat(rawGroup, ownerShip)) {
        return rawGroup;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  const suffix = lastError ? `: ${lastError}` : "";
  throw new Error(
    `Owner ${ownerShip} was not created as an invited member seat in ${groupId}${suffix}`
  );
}

async function getRawOwnerAdminVerification(
  groupId: string,
  ownerShip: string
): Promise<OwnerAdminVerification> {
  const rawGroup = await getRawGroupForAdminVerification(groupId);

  if (!rawGroup.admins?.includes(ADMIN_ROLE_ID)) {
    return {
      status: "missing",
      reason: `Group ${groupId} has an "${ADMIN_ROLE_ID}" role, but it is not marked as an admin role.`,
    };
  }

  const ownerSeat = getShipRecordValue(rawGroup.seats, ownerShip);
  if (ownerSeat) {
    if (ownerSeat.roles?.includes(ADMIN_ROLE_ID)) {
      return { status: "verified" };
    }

    return {
      status: "missing",
      reason: `Owner ${ownerShip} is a member of ${groupId}, but does not have the "${ADMIN_ROLE_ID}" role.`,
    };
  }

  const pendingRoles = getShipRecordValue(rawGroup.admissions?.pending, ownerShip);
  if (pendingRoles) {
    if (pendingRoles.includes(ADMIN_ROLE_ID)) {
      return {
        status: "missing",
        reason: `Owner ${ownerShip} has a pending invite for ${groupId} with the "${ADMIN_ROLE_ID}" role, but is not a group member seat yet.`,
      };
    }

    return {
      status: "missing",
      reason: `Owner ${ownerShip} has a pending invite for ${groupId}, but not with the "${ADMIN_ROLE_ID}" role.`,
    };
  }

  const ownerInvite = getShipRecordValue(rawGroup.admissions?.invited, ownerShip);
  if (ownerInvite) {
    return {
      status: "missing",
      reason: `Owner ${ownerShip} is invited to ${groupId}, but no pending "${ADMIN_ROLE_ID}" role assignment was found.`,
    };
  }

  return {
    status: "missing",
    reason: `Owner ${ownerShip} was not found in members or pending invites for ${groupId}.`,
  };
}

async function assignOwnerAdminRole(groupId: string, ownerShip: string) {
  const rawGroup = await getRawGroupWithOwnerSeat(groupId, ownerShip);
  const ownerSeat = getShipRecordValue(rawGroup.seats, ownerShip);

  if (ownerSeat?.roles?.includes(ADMIN_ROLE_ID)) {
    console.log(`✅ Owner already has "${ADMIN_ROLE_ID}" role.`);
    return;
  }

  console.log(`Assigning owner ${ownerShip} to "${ADMIN_ROLE_ID}" role...`);
  await addMembersToRole({
    groupId,
    roleId: ADMIN_ROLE_ID,
    ships: [ownerShip],
  });
  console.log(`✅ Owner assigned to "${ADMIN_ROLE_ID}" role.`);
}

async function getGroupWithRetry(groupId: string): Promise<Group> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      return await getGroup(groupId);
    } catch (err) {
      lastError = err;
      if (attempt < VERIFY_ATTEMPTS) {
        await sleep(VERIFY_DELAY_MS);
      }
    }
  }

  throw new Error(`Could not fetch group ${groupId} for verification: ${lastError}`);
}

async function verifyGroupCreated(groupId: string): Promise<Group> {
  console.log(`Verifying group ${groupId}...`);
  const group = await getGroupWithRetry(groupId);

  if (group.id && group.id !== groupId) {
    throw new Error(`Created group verification returned ${group.id}, expected ${groupId}.`);
  }

  console.log(`✅ Group verified.`);
  return group;
}

async function setAdminRole(groupId: string, roleId: string) {
  await poke({
    app: "groups",
    mark: "group-action-4",
    json: {
      group: {
        flag: groupId,
        "a-group": {
          role: {
            roles: [roleId],
            "a-role": {
              "set-admin": null,
            },
          },
        },
      },
    },
  });
}

async function ensureAdminRole(groupId: string, group?: Group) {
  const currentGroup = group ?? (await getGroup(groupId));

  if (!groupHasRole(currentGroup, ADMIN_ROLE_ID)) {
    console.log(`Creating "${ADMIN_ROLE_ID}" role in ${groupId}...`);
    await addGroupRole({
      groupId,
      roleId: ADMIN_ROLE_ID,
      meta: { title: "Admin", description: "Group administrator" },
    });

    await setAdminRole(groupId, ADMIN_ROLE_ID);
  }
}

async function verifyOwnerAdmin(groupId: string, ownerShip: string): Promise<void> {
  console.log(`Verifying ${ownerShip} admin assignment in ${groupId}...`);

  let lastVerification: OwnerAdminVerification | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawVerification = await getRawOwnerAdminVerification(groupId, ownerShip);
      if (rawVerification.status === "verified") {
        console.log(`✅ Owner admin assignment verified.`);
        return;
      }
      lastVerification = rawVerification;
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  if (lastVerification) {
    throw new Error(lastVerification.reason);
  }

  throw new Error(`Could not verify owner admin assignment for ${ownerShip}: ${lastError}`);
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
    const roles = (member.roles || []).map((r: { roleId: string }) => r.roleId);
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
async function createGroupWithChannel(
  title: string,
  description: string = "",
  options: CreateGroupWithChannelOptions = {}
): Promise<CreatedGroup> {
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
    memberIds: options.memberIds,
  });

  const createdGroup = await verifyGroupCreated(groupId);

  if (description) {
    console.log(`Setting group description...`);
    await updateGroupMeta({
      groupId,
      meta: {
        title,
        description,
        image: "",
        cover: "",
      },
    });
  }

  console.log(`✅ Group created successfully!`);
  console.log(`   ID: ${groupId}`);
  console.log(`   Title: ${title}`);
  console.log(`   Description: ${description || "(none)"}`);
  console.log(`   Channel: ${channelId}`);

  return { groupId, channelId, group: createdGroup };
}

async function createOwnedGroup(title: string, owner: string, description: string = "") {
  const ownerShip = normalizeShip(owner);
  const { groupId, channelId, group } = await createGroupWithChannel(title, description, {
    memberIds: [ownerShip],
  });

  await ensureAdminRole(groupId, group);
  await assignOwnerAdminRole(groupId, ownerShip);
  await verifyOwnerAdmin(groupId, ownerShip);

  console.log(`✅ Owned group created successfully!`);
  console.log(`   ID: ${groupId}`);
  console.log(`   Title: ${title}`);
  console.log(`   Description: ${description || "(none)"}`);
  console.log(`   Owner: ${ownerShip}`);
  console.log(`   Channel: ${channelId}`);

  return { groupId, channelId, ownerShip };
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
  const joinedGroup = await getJoinedGroupState(groupId);
  if (joinedGroup?.currentUserIsMember) {
    console.log(`Already a member of ${groupId}.`);
    return;
  }

  const foreignGroup = await getForeignGroupState(groupId);
  if (foreignGroup?.haveInvite) {
    await acceptInvite(groupId);
    return;
  }

  if (foreignGroup?.haveRequestedInvite) {
    console.log(`Invite already requested for ${groupId}.`);
    return;
  }

  const group = foreignGroup ?? (await getGroupPreviewState(groupId));

  if (group?.privacy === "public") {
    await joinNow(groupId);
    return;
  }

  if (group?.privacy === "private") {
    await requestInvite(groupId);
    return;
  }

  if (group?.privacy === "secret") {
    throw new Error(`Cannot join secret group ${groupId} without an invite.`);
  }

  console.log(`Group privacy unknown for ${groupId}; attempting join...`);
  await joinNow(groupId);
}

async function getJoinedGroupState(groupId: string): Promise<Group | null> {
  try {
    return await getGroup(groupId);
  } catch {
    return null;
  }
}

async function getForeignGroupState(groupId: string): Promise<Group | null> {
  try {
    const foreigns = await scry<Record<string, unknown>>({
      app: "groups",
      path: "/v1/foreigns",
    });
    const groups = toClientGroupsFromForeigns(foreigns as any);
    return groups.find((group: Group) => group.id === groupId) ?? null;
  } catch {
    return null;
  }
}

async function getGroupPreviewState(groupId: string): Promise<Group | null> {
  try {
    return await getGroupPreview(groupId);
  } catch {
    try {
      const groups = await getGroups();
      return groups.find((group) => group.id === groupId) ?? null;
    } catch {
      return null;
    }
  }
}

async function joinNow(groupId: string) {
  console.log(`Joining group ${groupId}...`);
  await apiJoinGroup(groupId);
  console.log(`✅ Join requested. Sync may take a moment to show membership.`);
}

async function requestInvite(groupId: string) {
  console.log(`Requesting invite to ${groupId}...`);
  await requestGroupInvitation(groupId);
  console.log(`✅ Invite requested.`);
}

async function acceptInvite(groupId: string) {
  console.log(`Accepting invite to ${groupId}...`);
  await apiJoinGroup(groupId);
  console.log(`✅ Invite accepted, joining group. Sync may take a moment to show membership.`);
}

async function rejectInvite(groupId: string) {
  console.log(`Rejecting invite to ${groupId}...`);
  await rejectGroupInvitation(groupId);
  console.log(`✅ Invite rejected.`);
}

async function cancelJoin(groupId: string) {
  console.log(`Canceling join for ${groupId}...`);
  await apiCancelGroupJoin(groupId);
  console.log(`✅ Join canceled.`);
}

async function rescindInviteRequest(groupId: string) {
  console.log(`Rescinding invite request for ${groupId}...`);
  await rescindGroupInvitationRequest(groupId);
  console.log(`✅ Invite request rescinded.`);
}

async function revokeInvites(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);

  console.log(`Revoking invites for ${normalizedShips.join(", ")} from ${groupId}...`);

  await revokeGroupMemberInvites({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Invites revoked.`);
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
  await ensureAdminRole(groupId);

  console.log(`Promoting ${normalizedShips.join(", ")} to admin in ${groupId}...`);

  await addMembersToRole({
    groupId,
    roleId: ADMIN_ROLE_ID,
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
    return r.id === ADMIN_ROLE_ID;
  });

  if (adminRoles.length === 0) {
    console.error(`No "${ADMIN_ROLE_ID}" role found in ${groupId}.`);
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

  if (!command || command === "--help" || command === "-h") {
    printGroupsHelp();
    process.exit(0);
  }

  if (wantsHelp(args.slice(1))) {
    printGroupsHelp(command);
    process.exit(0);
  }

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

    case "create-owned": {
      const title = args[1];
      const owner = getOption(args, "owner");
      if (!title || title.startsWith("--") || !owner || owner.startsWith("--")) {
        console.error(GROUPS_COMMAND_HELP["create-owned"]);
        process.exit(1);
      }
      const description = getOption(args, "description") || "";
      await createOwnedGroup(title, owner, description);
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
        console.error(GROUPS_COMMAND_HELP.join);
        process.exit(1);
      }
      await joinGroupById(groupId);
      break;
    }

    case "request-invite": {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP["request-invite"]);
        process.exit(1);
      }
      await requestInvite(groupId);
      break;
    }

    case "accept-invite": {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP["accept-invite"]);
        process.exit(1);
      }
      await acceptInvite(groupId);
      break;
    }

    case "reject-invite": {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP["reject-invite"]);
        process.exit(1);
      }
      await rejectInvite(groupId);
      break;
    }

    case "cancel-join": {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP["cancel-join"]);
        process.exit(1);
      }
      await cancelJoin(groupId);
      break;
    }

    case "rescind-request": {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP["rescind-request"]);
        process.exit(1);
      }
      await rescindInviteRequest(groupId);
      break;
    }

    case "revoke-invite": {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error(GROUPS_COMMAND_HELP["revoke-invite"]);
        process.exit(1);
      }
      await revokeInvites(groupId, ships);
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
        console.error(GROUPS_COMMAND_HELP["add-channel"]);
        process.exit(1);
      }
      if (looksLikePositionalChannelKind(args, 2)) {
        console.error("Error: channel kind must be passed with --kind, not as a positional argument.");
        console.error(GROUPS_COMMAND_HELP["add-channel"]);
        process.exit(1);
      }
      const kind = (getOption(args, "kind") as "chat" | "diary" | "heap") || "chat";
      const description = getOption(args, "description") || "";
      await addChannel(groupId, title, kind, description);
      break;
    }

    default:
      printGroupsHelp();
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
