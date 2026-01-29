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
 */

import { scry, poke, getConfig, getCurrentShip, normalizeShip } from './urbit-client';

interface GroupMeta {
  title: string;
  description: string;
  image: string;
  cover: string;
}

interface GroupV7 {
  meta: GroupMeta;
  admissions: {
    privacy: 'public' | 'private' | 'secret';
    banned?: { ships?: string[] };
    requests?: Record<string, any>;
    invited?: Record<string, any>;
  };
  seats?: Record<string, { roles: string[]; joined: number }>;
  roles?: Record<string, GroupMeta>;
  channels?: Record<string, any>;
  sections?: Record<string, any>;
  'section-order'?: string[];
  'flagged-content'?: any;
}

// Generate a random short ID for the group
function generateGroupSlug(): string {
  return Math.random().toString(36).substring(2, 10);
}

// List all groups
async function listGroups() {
  getConfig();
  
  const groups = await scry<Record<string, GroupV7>>({
    app: 'groups',
    path: '/v2/groups',
  });
  
  console.log('\n=== YOUR GROUPS ===\n');
  
  for (const [groupId, group] of Object.entries(groups)) {
    const memberCount = Object.keys(group.seats || {}).length;
    const channelCount = Object.keys(group.channels || {}).length;
    const privacy = group.admissions?.privacy || 'unknown';
    
    console.log(`📁 ${group.meta.title || groupId}`);
    console.log(`   ID: ${groupId}`);
    console.log(`   Privacy: ${privacy}`);
    console.log(`   Members: ${memberCount}, Channels: ${channelCount}`);
    if (group.meta.description) {
      console.log(`   Description: ${group.meta.description}`);
    }
    console.log('');
  }
}

// Get info about a specific group
async function getGroupInfo(groupId: string) {
  getConfig();
  
  const group = await scry<GroupV7>({
    app: 'groups',
    path: `/v2/ui/groups/${groupId}`,
  });
  
  console.log(`\n=== ${group.meta.title || groupId} ===\n`);
  console.log(`ID: ${groupId}`);
  console.log(`Privacy: ${group.admissions?.privacy || 'unknown'}`);
  console.log(`Description: ${group.meta.description || '(none)'}`);
  
  if (group.meta.image) {
    console.log(`Icon: ${group.meta.image}`);
  }
  
  console.log('\n--- Members ---');
  for (const [ship, seat] of Object.entries(group.seats || {})) {
    const roles = seat.roles.length > 0 ? ` [${seat.roles.join(', ')}]` : '';
    console.log(`  ${ship}${roles}`);
  }
  
  if (group.channels && Object.keys(group.channels).length > 0) {
    console.log('\n--- Channels ---');
    for (const [channelId, channel] of Object.entries(group.channels)) {
      const title = (channel as any).meta?.title || channelId;
      console.log(`  ${title} (${channelId})`);
    }
  }
  
  if (group.admissions?.invited && Object.keys(group.admissions.invited).length > 0) {
    console.log('\n--- Pending Invites ---');
    for (const ship of Object.keys(group.admissions.invited)) {
      console.log(`  ${ship}`);
    }
  }
}

// Create a new group
async function createGroup(title: string, description: string = '') {
  const config = getConfig();
  const ship = getCurrentShip();
  const slug = generateGroupSlug();
  const groupId = `${ship}/${slug}`;
  const channelSlug = `${slug}-general`;
  const channelId = `chat/${ship}/${channelSlug}`;
  
  console.log(`Creating group "${title}" with ID: ${groupId}...`);
  
  // Create group using thread via curl (Node fetch has issues with Tlon hosting)
  const threadBody = {
    groupId,
    meta: {
      title,
      description,
      image: '',
      cover: '',
    },
    guestList: [],
    channels: [
      {
        channelId,
        meta: {
          title: 'General',
          description: 'General chat',
          image: '',
          cover: '',
        },
      },
    ],
  };
  
  const { execSync } = require('child_process');
  
  // Login and get cookie, then create group - all via curl
  const curlCmd = `
    curl -s -X POST "${config.url}/~/login" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "password=${config.code}" \
      -c /tmp/urbit-skill-cookies.txt > /dev/null && \
    curl -s -X POST "${config.url}/spider/groups/group-create-thread/group-create-1/group-ui-2.json" \
      -H "Content-Type: application/json" \
      -b /tmp/urbit-skill-cookies.txt \
      -d '${JSON.stringify(threadBody).replace(/'/g, "'\\''")}'
  `;
  
  try {
    const result = execSync(curlCmd, { encoding: 'utf-8', timeout: 30000 });
    const parsed = JSON.parse(result);
    
    console.log(`✅ Group created successfully!`);
    console.log(`   ID: ${groupId}`);
    console.log(`   Title: ${title}`);
    console.log(`   Channel: ${channelId}`);
    
    return groupId;
  } catch (err: any) {
    throw new Error(`Failed to create group: ${err.message}`);
  }
}

// Invite ships to a group
async function inviteToGroup(groupId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Inviting ${normalizedShips.join(', ')} to ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      invite: {
        flag: groupId,
        ships: normalizedShips,
        'a-invite': {
          token: null,
          note: null,
        },
      },
    },
  });
  
  console.log(`✅ Invitations sent!`);
}

// Leave a group
async function leaveGroup(groupId: string) {
  getConfig();
  
  console.log(`Leaving group ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-leave',
    json: groupId,
  });
  
  console.log(`✅ Left group.`);
}

// Add a channel to an existing group
// Uses channel-action-1 mark to 'channels' app (from packages/shared/src/api/channelsApi.ts)
async function addChannel(groupId: string, title: string, kind: 'chat' | 'diary' | 'heap' = 'chat', description: string = '') {
  const config = getConfig();
  const ship = getCurrentShip();
  const slug = generateGroupSlug();
  const name = slug; // channel name/slug
  const nest = `${kind}/${ship}/${name}`;
  const shipWithoutTilde = ship.replace('~', '');
  
  console.log(`Adding channel "${title}" to group ${groupId}...`);
  
  const { execSync } = require('child_process');
  
  // channel-action-1 create payload (from urbit/channel.ts Create interface)
  const createPayload = {
    create: {
      kind,
      group: groupId,
      name,
      title,
      description,
      meta: null,
      readers: [],
      writers: [],
    },
  };
  
  const jsonPayload = JSON.stringify([{
    id: 1,
    action: 'poke',
    ship: shipWithoutTilde,
    app: 'channels',
    mark: 'channel-action-1',
    json: createPayload,
  }]);
  
  const timestamp = Date.now();
  
  const curlCmd = `
    curl -s -X POST "${config.url}/~/login" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "password=${config.code}" \
      -c /tmp/urbit-skill-cookies.txt > /dev/null && \
    curl -s -X PUT "${config.url}/~/channel/skill-channel-add-${timestamp}" \
      -H "Content-Type: application/json" \
      -b /tmp/urbit-skill-cookies.txt \
      -d '${jsonPayload.replace(/'/g, "'\\''")}'
  `;
  
  try {
    execSync(curlCmd, { encoding: 'utf-8', timeout: 30000, shell: '/bin/bash' });
    console.log(`✅ Channel created!`);
    console.log(`   Nest: ${nest}`);
    console.log(`   Title: ${title}`);
    console.log(`   Group: ${groupId}`);
    return nest;
  } catch (err: any) {
    throw new Error(`Failed to add channel: ${err.message}`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'list':
      await listGroups();
      break;
      
    case 'create': {
      const title = args[1];
      if (!title) {
        console.error('Usage: groups.ts create "Group Name" [--description "..."]');
        process.exit(1);
      }
      let description = '';
      const descIdx = args.indexOf('--description');
      if (descIdx !== -1 && args[descIdx + 1]) {
        description = args[descIdx + 1];
      }
      await createGroup(title, description);
      break;
    }
    
    case 'invite': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error('Usage: groups.ts invite <group-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await inviteToGroup(groupId, ships);
      break;
    }
    
    case 'info': {
      const groupId = args[1];
      if (!groupId) {
        console.error('Usage: groups.ts info <group-id>');
        process.exit(1);
      }
      await getGroupInfo(groupId);
      break;
    }
    
    case 'leave': {
      const groupId = args[1];
      if (!groupId) {
        console.error('Usage: groups.ts leave <group-id>');
        process.exit(1);
      }
      await leaveGroup(groupId);
      break;
    }
    
    case 'add-channel': {
      const groupId = args[1];
      const title = args[2];
      if (!groupId || !title) {
        console.error('Usage: groups.ts add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]');
        process.exit(1);
      }
      let kind: 'chat' | 'diary' | 'heap' = 'chat';
      let description = '';
      const kindIdx = args.indexOf('--kind');
      if (kindIdx !== -1 && args[kindIdx + 1]) {
        kind = args[kindIdx + 1] as 'chat' | 'diary' | 'heap';
      }
      const descIdx = args.indexOf('--description');
      if (descIdx !== -1 && args[descIdx + 1]) {
        description = args[descIdx + 1];
      }
      await addChannel(groupId, title, kind, description);
      break;
    }
    
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/groups.ts list');
      console.log('  npx ts-node scripts/groups.ts create "Group Name" [--description "..."]');
      console.log('  npx ts-node scripts/groups.ts invite <group-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts info <group-id>');
      console.log('  npx ts-node scripts/groups.ts leave <group-id>');
      console.log('  npx ts-node scripts/groups.ts add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]');
      process.exit(1);
  }
}

main().catch(console.error);
