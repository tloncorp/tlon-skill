#!/usr/bin/env npx ts-node
/**
 * Channel listing for Tlon/Urbit
 *
 * Usage:
 *   npx ts-node channels.ts dms        # List DMs
 *   npx ts-node channels.ts group-dms  # List group DMs (clubs)
 *   npx ts-node channels.ts groups     # List subscribed groups
 *   npx ts-node channels.ts all        # List all channels
 */

import { scry, closeClient, getCurrentShip } from "./urbit-client";

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

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    let result: any;

    switch (command) {
      case "dms":
        result = await getDms();
        break;

      case "group-dms":
        result = await getGroupDms();
        break;

      case "groups":
        result = await getGroups();
        break;

      case "all":
        result = await getAll();
        break;

      default:
        console.error(`
Usage: channels.ts <command>

Commands:
  dms        List direct messages
  group-dms  List group DMs (clubs)
  groups     List subscribed groups with their channels
  all        List all channels
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
