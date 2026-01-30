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

import { scry, poke, closeClient, getCurrentShip, getConfig } from "./urbit-client";

// Types
interface Club {
  team: string[];
  hive: string[];
  meta: {
    title?: string;
    description?: string;
    image?: string;
    cover?: string;
  };
}

type Clubs = Record<string, Club>;

interface GroupChannel {
  meta: {
    title: string;
    description: string;
    image: string;
    cover: string;
  };
  added: number;
  readers: string[];
  zone: string;
  join: boolean;
}

interface GroupZone {
  meta: {
    title: string;
    description: string;
    image: string;
    cover: string;
  };
  idx: string[];
}

interface Group {
  meta: {
    title: string;
    description: string;
    image: string;
    cover: string;
  };
  fleet: Record<string, { sects: string[]; joined: number }>;
  cabals: Record<string, { meta: any }>;
  zones: Record<string, GroupZone>;
  "zone-ord": string[];
  channels: Record<string, GroupChannel>;
  bloc: string[];
  secret: boolean;
  cordon: any;
  flagged: any;
}

type Groups = Record<string, Group>;

// Get DMs
async function getDms() {
  const dms = await scry<string[]>({
    app: "chat",
    path: "/dm",
  });
  return dms.map((ship) => ({
    type: "dm",
    id: ship,
    contact: ship,
  }));
}

// Get group DMs (clubs)
async function getGroupDms() {
  const currentShip = getCurrentShip();
  const clubs = await scry<Clubs>({
    app: "chat",
    path: "/clubs",
  });

  return Object.entries(clubs).map(([id, club]) => {
    const isJoined = club.team.includes(currentShip);
    const isInvited = club.hive.includes(currentShip);

    return {
      type: "groupDm",
      id,
      title: club.meta.title || "Untitled",
      description: club.meta.description || "",
      members: club.team,
      invited: club.hive,
      status: isJoined ? "joined" : isInvited ? "invited" : "unknown",
    };
  });
}

// Get subscribed groups
async function getGroups() {
  const groups = await scry<Groups>({
    app: "groups",
    path: "/groups",
  });

  return Object.entries(groups).map(([flag, group]) => {
    const channelList = Object.entries(group.channels).map(([nest, channel]) => ({
      nest,
      title: channel.meta.title,
      zone: channel.zone,
    }));

    return {
      type: "group",
      id: flag,
      title: group.meta.title,
      description: group.meta.description,
      image: group.meta.image,
      secret: group.secret,
      memberCount: Object.keys(group.fleet).length,
      channels: channelList,
    };
  });
}

// Get all channels combined
async function getAll() {
  const [dms, groupDms, groups] = await Promise.all([
    getDms(),
    getGroupDms(),
    getGroups(),
  ]);

  return {
    dms,
    groupDms,
    groups,
  };
}

// Parse nest into components: kind/~host/name -> { kind, host, name, group }
function parseNest(nest: string): { kind: string; host: string; name: string } {
  const parts = nest.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid nest format: ${nest}. Expected: kind/~host/name`);
  }
  return {
    kind: parts[0],
    host: parts[1].startsWith('~') ? parts[1] : `~${parts[1]}`,
    name: parts[2],
  };
}

// Find which group a channel belongs to
async function findChannelGroup(nest: string): Promise<string | null> {
  const groups = await scry<Groups>({
    app: "groups",
    path: "/groups",
  });
  
  for (const [flag, group] of Object.entries(groups)) {
    if (group.channels && group.channels[nest]) {
      return flag;
    }
  }
  return null;
}

// Get channel info
async function getChannelInfo(nest: string) {
  const { kind, host, name } = parseNest(nest);
  
  // Find the group this channel belongs to
  const groupFlag = await findChannelGroup(nest);
  if (!groupFlag) {
    throw new Error(`Channel ${nest} not found in any group`);
  }
  
  const groups = await scry<Groups>({
    app: "groups",
    path: "/groups",
  });
  
  const group = groups[groupFlag];
  const channel = group.channels[nest];
  
  console.log(`\n=== ${channel.meta.title || name} ===\n`);
  console.log(`Nest: ${nest}`);
  console.log(`Kind: ${kind}`);
  console.log(`Group: ${group.meta.title} (${groupFlag})`);
  console.log(`Zone: ${channel.zone}`);
  console.log(`Description: ${channel.meta.description || '(none)'}`);
  console.log(`Readers: ${channel.readers.length > 0 ? channel.readers.join(', ') : '(all members)'}`);
  
  return {
    nest,
    kind,
    group: groupFlag,
    groupTitle: group.meta.title,
    title: channel.meta.title,
    description: channel.meta.description,
    zone: channel.zone,
    readers: channel.readers,
  };
}

// Update channel metadata
async function updateChannel(nest: string, options: { title?: string; description?: string }) {
  getConfig();
  
  const { kind, host, name } = parseNest(nest);
  
  // Find the group this channel belongs to
  const groupFlag = await findChannelGroup(nest);
  if (!groupFlag) {
    throw new Error(`Channel ${nest} not found in any group`);
  }
  
  // Get current channel info to preserve existing values
  const groups = await scry<Groups>({
    app: "groups",
    path: "/groups",
  });
  
  const group = groups[groupFlag];
  const channel = group.channels[nest];
  
  // Build the full GroupChannelV7 structure for edit
  const channelUpdate = {
    added: channel.added,
    meta: {
      title: options.title ?? channel.meta.title,
      description: options.description ?? channel.meta.description,
      image: channel.meta.image || '',
      cover: channel.meta.cover || '',
    },
    section: channel.zone || 'default',
    readers: channel.readers || [],
    join: channel.join ?? true,
  };
  
  console.log(`Updating channel ${nest}...`);
  
  // Update via groups agent (channel meta edit)
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupFlag,
        'a-group': {
          channel: {
            nest,
            'a-channel': {
              edit: channelUpdate,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Channel updated.`);
  console.log(`   Title: ${channelUpdate.meta.title}`);
  console.log(`   Description: ${channelUpdate.meta.description || '(none)'}`);
}

// Delete a channel
async function deleteChannel(nest: string) {
  getConfig();
  
  const { kind, host, name } = parseNest(nest);
  
  // Find the group this channel belongs to
  const groupFlag = await findChannelGroup(nest);
  if (!groupFlag) {
    throw new Error(`Channel ${nest} not found in any group`);
  }
  
  console.log(`Deleting channel ${nest} from group ${groupFlag}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupFlag,
        'a-group': {
          channel: {
            nest,
            'a-channel': {
              del: null,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Channel deleted.`);
}

// Parse command line argument for named options
function getOption(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    let result: any;

    switch (command) {
      case "dms":
        result = await getDms();
        console.log(JSON.stringify(result, null, 2));
        break;

      case "group-dms":
        result = await getGroupDms();
        console.log(JSON.stringify(result, null, 2));
        break;

      case "groups":
        result = await getGroups();
        console.log(JSON.stringify(result, null, 2));
        break;

      case "all":
        result = await getAll();
        console.log(JSON.stringify(result, null, 2));
        break;

      case "info": {
        const nest = args[1];
        if (!nest) {
          console.error('Usage: channels.ts info <nest>');
          console.error('Example: channels.ts info chat/~ship/channel-name');
          process.exit(1);
        }
        await getChannelInfo(nest);
        break;
      }

      case "update": {
        const nest = args[1];
        if (!nest) {
          console.error('Usage: channels.ts update <nest> --title "..." [--description "..."]');
          console.error('Example: channels.ts update chat/~ship/channel-name --title "New Title"');
          process.exit(1);
        }
        const title = getOption(args, 'title');
        const description = getOption(args, 'description');
        if (!title && !description) {
          console.error('At least one option required: --title or --description');
          process.exit(1);
        }
        await updateChannel(nest, { title, description });
        break;
      }

      case "delete": {
        const nest = args[1];
        if (!nest) {
          console.error('Usage: channels.ts delete <nest>');
          console.error('Example: channels.ts delete chat/~ship/channel-name');
          process.exit(1);
        }
        await deleteChannel(nest);
        break;
      }

      default:
        console.error(`
Usage: channels.ts <command>

Commands:
  dms                List direct messages
  group-dms          List group DMs (clubs)
  groups             List subscribed groups with their channels
  all                List all channels
  info <nest>        Get channel info
  update <nest>      Update channel --title "..." [--description "..."]
  delete <nest>      Delete a channel (must be group admin)

Nest format: kind/~host/name (e.g., chat/~zod/general)
`);
        process.exit(1);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await closeClient();
  }
}

main();
