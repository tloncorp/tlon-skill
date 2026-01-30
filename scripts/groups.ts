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
 *   npx ts-node scripts/groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts set-privacy <group-id> <public|private|secret>
 *   npx ts-node scripts/groups.ts accept-join <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts reject-join <group-id> <ship> [<ship2> ...]
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
  
  if (group.roles && Object.keys(group.roles).length > 0) {
    console.log('\n--- Roles ---');
    for (const [roleId, role] of Object.entries(group.roles)) {
      console.log(`  ${roleId}: ${role.title || '(untitled)'}`);
    }
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
  
  if (group.admissions?.requests && Object.keys(group.admissions.requests).length > 0) {
    console.log('\n--- Join Requests ---');
    for (const ship of Object.keys(group.admissions.requests)) {
      console.log(`  ${ship}`);
    }
  }
  
  if (group.admissions?.banned?.ships && group.admissions.banned.ships.length > 0) {
    console.log('\n--- Banned Ships ---');
    for (const ship of group.admissions.banned.ships) {
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

// Join a group
async function joinGroup(groupId: string) {
  getConfig();
  
  console.log(`Joining group ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-join',
    json: {
      flag: groupId,
      'join-all': true,
    },
  });
  
  console.log(`✅ Join request sent! (May need approval if group is private)`);
}

// Delete a group (must be host)
async function deleteGroup(groupId: string) {
  getConfig();
  
  console.log(`Deleting group ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          delete: null,
        },
      },
    },
  });
  
  console.log(`✅ Group deleted.`);
}

// Update group metadata
async function updateGroup(groupId: string, options: { title?: string; description?: string; image?: string; cover?: string }) {
  getConfig();
  
  // First, get current group info to preserve existing values
  const group = await scry<GroupV7>({
    app: 'groups',
    path: `/v2/ui/groups/${groupId}`,
  });
  
  const meta: GroupMeta = {
    title: options.title ?? group.meta.title,
    description: options.description ?? group.meta.description,
    image: options.image ?? group.meta.image,
    cover: options.cover ?? group.meta.cover,
  };
  
  console.log(`Updating group ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          meta,
        },
      },
    },
  });
  
  console.log(`✅ Group updated.`);
  console.log(`   Title: ${meta.title}`);
  console.log(`   Description: ${meta.description || '(none)'}`);
}

// Kick members from a group
async function kickMembers(groupId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Kicking ${normalizedShips.join(', ')} from ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          seat: {
            ships: normalizedShips,
            'a-seat': {
              del: null,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Members kicked.`);
}

// Ban members from a group
async function banMembers(groupId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Banning ${normalizedShips.join(', ')} from ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          entry: {
            ban: {
              'add-ships': normalizedShips,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Members banned.`);
}

// Unban members from a group
async function unbanMembers(groupId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Unbanning ${normalizedShips.join(', ')} from ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          entry: {
            ban: {
              'del-ships': normalizedShips,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Members unbanned.`);
}

// Add a role to a group
async function addRole(groupId: string, roleId: string, options: { title?: string; description?: string }) {
  getConfig();
  
  const title = options.title || roleId;
  const description = options.description || '';
  
  console.log(`Adding role "${roleId}" to ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          role: {
            roles: [roleId],
            'a-role': {
              add: {
                title,
                description,
                image: '',
                cover: '',
              },
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Role "${roleId}" added.`);
  console.log(`   Title: ${title}`);
}

// Delete a role from a group
async function deleteRole(groupId: string, roleId: string) {
  getConfig();
  
  console.log(`Deleting role "${roleId}" from ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          role: {
            roles: [roleId],
            'a-role': {
              del: null,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Role "${roleId}" deleted.`);
}

// Update a role's metadata
async function updateRole(groupId: string, roleId: string, options: { title?: string; description?: string }) {
  getConfig();
  
  // Get current role info first
  const group = await scry<GroupV7>({
    app: 'groups',
    path: `/v2/ui/groups/${groupId}`,
  });
  
  const currentRole = group.roles?.[roleId];
  if (!currentRole) {
    throw new Error(`Role "${roleId}" not found in group ${groupId}`);
  }
  
  const meta = {
    title: options.title ?? currentRole.title,
    description: options.description ?? currentRole.description,
    image: currentRole.image || '',
    cover: currentRole.cover || '',
  };
  
  console.log(`Updating role "${roleId}" in ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          role: {
            roles: [roleId],
            'a-role': {
              edit: meta,
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Role "${roleId}" updated.`);
  console.log(`   Title: ${meta.title}`);
}

// Assign a role to members
async function assignRole(groupId: string, roleId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Assigning role "${roleId}" to ${normalizedShips.join(', ')} in ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          seat: {
            ships: normalizedShips,
            'a-seat': {
              'add-roles': [roleId],
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Role assigned.`);
}

// Remove a role from members
async function removeRole(groupId: string, roleId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Removing role "${roleId}" from ${normalizedShips.join(', ')} in ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          seat: {
            ships: normalizedShips,
            'a-seat': {
              'del-roles': [roleId],
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Role removed.`);
}

// Set group privacy
async function setPrivacy(groupId: string, privacy: 'public' | 'private' | 'secret') {
  getConfig();
  
  console.log(`Setting ${groupId} privacy to "${privacy}"...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          entry: {
            privacy,
          },
        },
      },
    },
  });
  
  console.log(`✅ Privacy set to "${privacy}".`);
}

// Accept join requests
async function acceptJoin(groupId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Accepting join requests from ${normalizedShips.join(', ')} for ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          entry: {
            ask: {
              ships: normalizedShips,
              'a-ask': 'approve',
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Join requests accepted.`);
}

// Reject join requests
async function rejectJoin(groupId: string, ships: string[]) {
  getConfig();
  
  const normalizedShips = ships.map(normalizeShip);
  
  console.log(`Rejecting join requests from ${normalizedShips.join(', ')} for ${groupId}...`);
  
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          entry: {
            ask: {
              ships: normalizedShips,
              'a-ask': 'deny',
            },
          },
        },
      },
    },
  });
  
  console.log(`✅ Join requests rejected.`);
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

// Parse command line argument for named options
function getOption(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
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
      const description = getOption(args, 'description') || '';
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
    
    case 'join': {
      const groupId = args[1];
      if (!groupId) {
        console.error('Usage: groups.ts join <group-id>');
        process.exit(1);
      }
      await joinGroup(groupId);
      break;
    }
    
    case 'delete': {
      const groupId = args[1];
      if (!groupId) {
        console.error('Usage: groups.ts delete <group-id>');
        process.exit(1);
      }
      await deleteGroup(groupId);
      break;
    }
    
    case 'update': {
      const groupId = args[1];
      if (!groupId) {
        console.error('Usage: groups.ts update <group-id> --title "..." [--description "..."] [--image "..."] [--cover "..."]');
        process.exit(1);
      }
      const title = getOption(args, 'title');
      const description = getOption(args, 'description');
      const image = getOption(args, 'image');
      const cover = getOption(args, 'cover');
      if (!title && !description && !image && !cover) {
        console.error('At least one option required: --title, --description, --image, --cover');
        process.exit(1);
      }
      await updateGroup(groupId, { title, description, image, cover });
      break;
    }
    
    case 'kick': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error('Usage: groups.ts kick <group-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await kickMembers(groupId, ships);
      break;
    }
    
    case 'ban': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error('Usage: groups.ts ban <group-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await banMembers(groupId, ships);
      break;
    }
    
    case 'unban': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error('Usage: groups.ts unban <group-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await unbanMembers(groupId, ships);
      break;
    }
    
    case 'add-role': {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        console.error('Usage: groups.ts add-role <group-id> <role-id> --title "..." [--description "..."]');
        process.exit(1);
      }
      const title = getOption(args, 'title');
      const description = getOption(args, 'description');
      await addRole(groupId, roleId, { title, description });
      break;
    }
    
    case 'delete-role': {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        console.error('Usage: groups.ts delete-role <group-id> <role-id>');
        process.exit(1);
      }
      await deleteRole(groupId, roleId);
      break;
    }
    
    case 'update-role': {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        console.error('Usage: groups.ts update-role <group-id> <role-id> --title "..." [--description "..."]');
        process.exit(1);
      }
      const title = getOption(args, 'title');
      const description = getOption(args, 'description');
      if (!title && !description) {
        console.error('At least one option required: --title or --description');
        process.exit(1);
      }
      await updateRole(groupId, roleId, { title, description });
      break;
    }
    
    case 'assign-role': {
      const groupId = args[1];
      const roleId = args[2];
      // Filter out any --flags from ships list
      const ships = args.slice(3).filter(s => !s.startsWith('--'));
      if (!groupId || !roleId || ships.length === 0) {
        console.error('Usage: groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await assignRole(groupId, roleId, ships);
      break;
    }
    
    case 'remove-role': {
      const groupId = args[1];
      const roleId = args[2];
      // Filter out any --flags from ships list
      const ships = args.slice(3).filter(s => !s.startsWith('--'));
      if (!groupId || !roleId || ships.length === 0) {
        console.error('Usage: groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await removeRole(groupId, roleId, ships);
      break;
    }
    
    case 'set-privacy': {
      const groupId = args[1];
      const privacy = args[2] as 'public' | 'private' | 'secret';
      if (!groupId || !privacy || !['public', 'private', 'secret'].includes(privacy)) {
        console.error('Usage: groups.ts set-privacy <group-id> <public|private|secret>');
        process.exit(1);
      }
      await setPrivacy(groupId, privacy);
      break;
    }
    
    case 'accept-join': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error('Usage: groups.ts accept-join <group-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await acceptJoin(groupId, ships);
      break;
    }
    
    case 'reject-join': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error('Usage: groups.ts reject-join <group-id> <ship> [<ship2> ...]');
        process.exit(1);
      }
      await rejectJoin(groupId, ships);
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
      const kindOpt = getOption(args, 'kind');
      if (kindOpt && ['chat', 'diary', 'heap'].includes(kindOpt)) {
        kind = kindOpt as 'chat' | 'diary' | 'heap';
      }
      const description = getOption(args, 'description') || '';
      await addChannel(groupId, title, kind, description);
      break;
    }
    
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/groups.ts list');
      console.log('  npx ts-node scripts/groups.ts create "Group Name" [--description "..."]');
      console.log('  npx ts-node scripts/groups.ts info <group-id>');
      console.log('  npx ts-node scripts/groups.ts invite <group-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts leave <group-id>');
      console.log('  npx ts-node scripts/groups.ts join <group-id>');
      console.log('');
      console.log('Group Administration (host only):');
      console.log('  npx ts-node scripts/groups.ts delete <group-id>');
      console.log('  npx ts-node scripts/groups.ts update <group-id> --title "..." [--description "..."] [--image "..."]');
      console.log('  npx ts-node scripts/groups.ts kick <group-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts ban <group-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts unban <group-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts set-privacy <group-id> <public|private|secret>');
      console.log('  npx ts-node scripts/groups.ts accept-join <group-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts reject-join <group-id> <ship> [<ship2> ...]');
      console.log('');
      console.log('Role Management:');
      console.log('  npx ts-node scripts/groups.ts add-role <group-id> <role-id> --title "..." [--description "..."]');
      console.log('  npx ts-node scripts/groups.ts update-role <group-id> <role-id> --title "..." [--description "..."]');
      console.log('  npx ts-node scripts/groups.ts delete-role <group-id> <role-id>');
      console.log('  npx ts-node scripts/groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]');
      console.log('  npx ts-node scripts/groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]');
      console.log('');
      console.log('Channels:');
      console.log('  npx ts-node scripts/groups.ts add-channel <group-id> "Channel Name" [--kind chat|diary|heap] [--description "..."]');
      process.exit(1);
  }
}

main().catch(console.error);
