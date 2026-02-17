#!/usr/bin/env npx ts-node
/**
 * Channel listing and management for Tlon/Urbit
 *
 * Usage:
 *   npx ts-node channels.ts dms        # List DMs
 *   npx ts-node channels.ts group-dms  # List group DMs (clubs)
 *   npx ts-node channels.ts groups     # List subscribed groups
 *   npx ts-node channels.ts all        # List all channels
 *   npx ts-node channels.ts info <nest>   # Get channel info
 *   npx ts-node channels.ts update <nest> --title "..." [--description "..."]
 *   npx ts-node channels.ts delete <nest> # Delete a channel (must be group admin)
 */

import { deleteChannel, getGroups, getInitData, updateChannel } from "@tloncorp/api";
import type { Channel as ApiChannel, Group as ApiGroup } from "@tloncorp/api";
import { disconnectClient, ensureClient, ensureConnectedClient, getCurrentShip } from "./api-client";

// Get DMs
async function getDms() {
  const init = await getInitData();
  const dms = init.channels.filter((channel) => channel.type === "dm");
  return dms.map((dm) => ({
    type: "dm",
    id: dm.id,
    contact: dm.contactId || dm.id,
  }));
}

// Get group DMs (clubs)
async function getGroupDms() {
  const currentShip = await getCurrentShip();
  const init = await getInitData();
  const groupDms = init.channels.filter((channel) => channel.type === "groupDm");

  return groupDms.map((dm) => {
    const members = dm.members || [];
    const joined = members.filter((member) => member.status === "joined");
    const invited = members.filter((member) => member.status === "invited");
    const isJoined = joined.some((member) => member.contactId === currentShip);
    const isInvited = invited.some((member) => member.contactId === currentShip);

    return {
      type: "groupDm",
      id: dm.id,
      title: dm.title || "Untitled",
      description: dm.description || "",
      members: joined.map((member) => member.contactId),
      invited: invited.map((member) => member.contactId),
      status: isJoined ? "joined" : isInvited ? "invited" : "unknown",
    };
  });
}

// Get subscribed groups
async function getGroupsList() {
  const groups = await getGroupsApi();

  return groups.map((group) => {
    const channelList = (group.channels || []).map((channel) => ({
      nest: channel.id,
      title: channel.title || channel.id,
      zone: findChannelSectionId(group, channel.id),
    }));

    return {
      type: "group",
      id: group.id,
      title: group.title,
      description: group.description,
      image: group.iconImage,
      secret: group.privacy === "secret",
      memberCount: group.memberCount ?? (group.members || []).length,
      channels: channelList,
    };
  });
}

// Get all channels combined
async function getAll() {
  const [dms, groupDms, groups] = await Promise.all([
    getDms(),
    getGroupDms(),
    getGroupsList(),
  ]);

  return {
    dms,
    groupDms,
    groups,
  };
}

// Parse nest into components: kind/~host/name -> { kind, host, name, group }
function parseNest(nest: string): { kind: string; host: string; name: string } {
  const parts = nest.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid nest format: ${nest}. Expected: kind/~host/name`);
  }
  return {
    kind: parts[0],
    host: parts[1].startsWith("~") ? parts[1] : `~${parts[1]}`,
    name: parts[2],
  };
}

// Find which group a channel belongs to
async function findChannelGroup(
  nest: string
): Promise<{ group: ApiGroup; channel: ApiChannel } | null> {
  const groups = await getGroupsApi();
  for (const group of groups) {
    const channel = (group.channels || []).find((c) => c.id === nest);
    if (channel) {
      return { group, channel };
    }
  }
  return null;
}

// Get channel info
async function getChannelInfo(nest: string) {
  const { kind, name } = parseNest(nest);

  // Find the group this channel belongs to
  const match = await findChannelGroup(nest);
  if (!match) {
    throw new Error(`Channel ${nest} not found in any group`);
  }

  const { group, channel } = match;

  console.log(`\n=== ${channel.title || name} ===\n`);
  console.log(`Nest: ${nest}`);
  console.log(`Kind: ${kind}`);
  console.log(`Group: ${group.title} (${group.id})`);
  console.log(`Zone: ${findChannelSectionId(group, channel.id)}`);
  console.log(`Description: ${channel.description || "(none)"}`);
  const readerRoles = (channel.readerRoles || []).map((r) => r.roleId);
  console.log(
    `Readers: ${readerRoles.length > 0 ? readerRoles.join(", ") : "(all members)"}`
  );

  return {
    nest,
    kind,
    group: group.id,
    groupTitle: group.title,
    title: channel.title,
    description: channel.description,
    zone: findChannelSectionId(group, channel.id),
    readers: readerRoles,
  };
}

// Update channel metadata
async function updateChannelMeta(
  nest: string,
  options: { title?: string; description?: string }
) {
  // Use connected client for mutations that require trackedPoke
  await ensureConnectedClient();

  const match = await findChannelGroup(nest);
  if (!match) {
    throw new Error(`Channel ${nest} not found in any group`);
  }

  const { group, channel } = match;
  const sectionId = findChannelSectionId(group, channel.id) || "default";
  const description = options.description ?? channel.description ?? "";
  const channelContentConfiguration = channel.contentConfiguration ?? undefined;
  const encodedDescription = JSON.stringify({
    description,
    channelContentConfiguration,
  });

  const channelUpdate = {
    added: channel.addedToGroupAt ?? Date.now(),
    meta: {
      title: options.title ?? channel.title ?? "",
      description: encodedDescription,
      image: channel.iconImage || "",
      cover: channel.coverImage || "",
    },
    section: sectionId,
    readers: (channel.readerRoles || []).map((r) => r.roleId),
    join: channel.currentUserIsMember ?? true,
  };

  console.log(`Updating channel ${nest}...`);

  try {
    await updateChannel({
      groupId: group.id,
      channelId: nest,
      channel: channelUpdate,
    });
  } finally {
    // Clean up connection after mutation
    disconnectClient();
  }

  console.log(`✅ Channel updated.`);
  console.log(`   Title: ${channelUpdate.meta.title}`);
  console.log(`   Description: ${description || "(none)"}`);
}

// Delete a channel
async function deleteChannelByNest(nest: string) {
  // Use connected client for mutations that require trackedPoke
  await ensureConnectedClient();

  const match = await findChannelGroup(nest);
  if (!match) {
    throw new Error(`Channel ${nest} not found in any group`);
  }

  console.log(`Deleting channel ${nest} from group ${match.group.id}...`);

  try {
    await deleteChannel({
      groupId: match.group.id,
      channelId: nest,
    });
  } finally {
    // Clean up connection after mutation
    disconnectClient();
  }

  console.log(`✅ Channel deleted.`);
}

async function getGroupsApi(): Promise<ApiGroup[]> {
  await ensureClient();
  return getGroups();
}

function findChannelSectionId(group: ApiGroup, channelId: string): string {
  const section = (group.navSections || []).find((nav) =>
    (nav.channels || []).some((channel) => channel.channelId === channelId)
  );
  return section?.sectionId || "default";
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    await ensureClient();
    switch (command) {
      case "dms": {
        const dms = await getDms();
        console.log(JSON.stringify(dms, null, 2));
        break;
      }

      case "group-dms": {
        const dms = await getGroupDms();
        console.log(JSON.stringify(dms, null, 2));
        break;
      }

      case "groups": {
        const groups = await getGroupsList();
        console.log(JSON.stringify(groups, null, 2));
        break;
      }

      case "all": {
        const all = await getAll();
        console.log(JSON.stringify(all, null, 2));
        break;
      }

      case "info": {
        const nest = args[1];
        if (!nest) {
          console.error("Usage: channels.ts info <nest>");
          console.error("Example: channels.ts info chat/~ship/channel-name");
          process.exit(1);
        }
        await getChannelInfo(nest);
        break;
      }

      case "update": {
        const nest = args[1];
        if (!nest) {
          console.error("Usage: channels.ts update <nest> --title \"...\" [--description \"...\"]");
          console.error("Example: channels.ts update chat/~ship/channel-name --title \"New Title\"");
          process.exit(1);
        }

        // Parse options
        const titleIdx = args.indexOf("--title");
        const descriptionIdx = args.indexOf("--description");
        const title = titleIdx !== -1 ? args[titleIdx + 1] : undefined;
        const description = descriptionIdx !== -1 ? args[descriptionIdx + 1] : undefined;

        if (!title && !description) {
          console.error("Error: At least one of --title or --description is required");
          process.exit(1);
        }

        await updateChannelMeta(nest, { title, description });
        break;
      }

      case "delete": {
        const nest = args[1];
        if (!nest) {
          console.error("Usage: channels.ts delete <nest>");
          console.error("Example: channels.ts delete chat/~ship/channel-name");
          process.exit(1);
        }
        await deleteChannelByNest(nest);
        break;
      }

      default:
        console.log(`Usage: channels.ts <command>

Commands:
  dms                List DMs
  group-dms          List group DMs (clubs)
  groups             List subscribed groups with their channels
  all                List all channels
  info <nest>        Get channel info
  update <nest>      Update channel --title "..." [--description "..."]
  delete <nest>      Delete a channel (must be group admin)
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
