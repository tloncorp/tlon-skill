#!/usr/bin/env npx ts-node
/**
 * Manage Moltbot settings in Urbit settings-store.
 * 
 * Usage:
 *   npx ts-node scripts/settings.ts get
 *   npx ts-node scripts/settings.ts set dmAllowlist '["~nocsyx-lassul", "~sabrys-nocwyd"]'
 *   npx ts-node scripts/settings.ts allow-dm ~ship
 *   npx ts-node scripts/settings.ts allow-channel chat/~host/channel
 *   npx ts-node scripts/settings.ts open-channel chat/~host/channel
 *   npx ts-node scripts/settings.ts set-rule chat/~host/channel open
 *   npx ts-node scripts/settings.ts set-rule chat/~host/channel restricted ~ship1 ~ship2
 */

import { scry, poke, closeClient, normalizeShip } from './urbit-client';

const SETTINGS_DESK = 'moltbot';
const SETTINGS_BUCKET = 'tlon';

async function getSettings(): Promise<Record<string, unknown>> {
  try {
    const result = await scry<{ all: Record<string, Record<string, Record<string, unknown>>> }>({
      app: 'settings',
      path: '/all',
    });
    return (result?.all?.[SETTINGS_DESK]?.[SETTINGS_BUCKET] as Record<string, unknown>) ?? {};
  } catch (err: any) {
    if (err?.message?.includes('404') || err?.message?.includes('not found')) {
      return {};
    }
    throw err;
  }
}

async function putEntry(key: string, value: unknown): Promise<void> {
  await poke({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'put-entry': {
        desk: SETTINGS_DESK,
        'bucket-key': SETTINGS_BUCKET,
        'entry-key': key,
        value,
      },
    },
  });
  console.log(`✓ Set ${key}`);
}

async function delEntry(key: string): Promise<void> {
  await poke({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'del-entry': {
        desk: SETTINGS_DESK,
        'bucket-key': SETTINGS_BUCKET,
        'entry-key': key,
      },
    },
  });
  console.log(`✓ Deleted ${key}`);
}

async function addToArray(key: string, item: string): Promise<void> {
  const settings = await getSettings();
  const current = (settings[key] as string[]) ?? [];
  const normalized = key === 'dmAllowlist' || key === 'defaultAuthorizedShips' 
    ? normalizeShip(item) 
    : item;
  
  if (current.includes(normalized)) {
    console.log(`${normalized} already in ${key}`);
    return;
  }
  
  await putEntry(key, [...current, normalized]);
}

async function removeFromArray(key: string, item: string): Promise<void> {
  const settings = await getSettings();
  const current = (settings[key] as string[]) ?? [];
  const normalized = key === 'dmAllowlist' || key === 'defaultAuthorizedShips'
    ? normalizeShip(item)
    : item;
  
  const updated = current.filter(x => x !== normalized);
  if (updated.length === current.length) {
    console.log(`${normalized} not in ${key}`);
    return;
  }
  
  await putEntry(key, updated);
}

function parseChannelRules(value: unknown): Record<string, { mode?: string; allowedShips?: string[] }> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, { mode?: string; allowedShips?: string[] }>;
  }
  return {};
}

async function setChannelRule(
  channel: string, 
  mode: 'open' | 'restricted', 
  allowedShips?: string[]
): Promise<void> {
  const settings = await getSettings();
  const rules = parseChannelRules(settings.channelRules);
  
  const rule: Record<string, unknown> = { mode };
  if (mode === 'restricted' && allowedShips?.length) {
    rule.allowedShips = allowedShips.map(normalizeShip);
  }
  
  // Store as JSON string (settings-store doesn't support nested objects)
  await putEntry('channelRules', JSON.stringify({ ...rules, [channel]: rule }));
}

async function main() {
  const [,, command, ...args] = process.argv;
  
  try {
    switch (command) {
      case 'get': {
        const settings = await getSettings();
        console.log(JSON.stringify(settings, null, 2));
        break;
      }
      
      case 'set': {
        const [key, jsonValue] = args;
        if (!key || jsonValue === undefined) {
          console.error('Usage: settings set <key> <json-value>');
          process.exit(1);
        }
        const value = JSON.parse(jsonValue);
        await putEntry(key, value);
        break;
      }
      
      case 'delete':
      case 'del': {
        const [key] = args;
        if (!key) {
          console.error('Usage: settings delete <key>');
          process.exit(1);
        }
        await delEntry(key);
        break;
      }
      
      case 'allow-dm':
      case 'add-dm': {
        const [ship] = args;
        if (!ship) {
          console.error('Usage: settings allow-dm <ship>');
          process.exit(1);
        }
        await addToArray('dmAllowlist', ship);
        break;
      }
      
      case 'remove-dm': {
        const [ship] = args;
        if (!ship) {
          console.error('Usage: settings remove-dm <ship>');
          process.exit(1);
        }
        await removeFromArray('dmAllowlist', ship);
        break;
      }
      
      case 'allow-channel':
      case 'add-channel': {
        const [channel] = args;
        if (!channel) {
          console.error('Usage: settings allow-channel <channel-nest>');
          process.exit(1);
        }
        await addToArray('groupChannels', channel);
        break;
      }
      
      case 'remove-channel': {
        const [channel] = args;
        if (!channel) {
          console.error('Usage: settings remove-channel <channel-nest>');
          process.exit(1);
        }
        await removeFromArray('groupChannels', channel);
        break;
      }
      
      case 'open-channel': {
        const [channel] = args;
        if (!channel) {
          console.error('Usage: settings open-channel <channel-nest>');
          process.exit(1);
        }
        await setChannelRule(channel, 'open');
        console.log(`✓ Opened ${channel} to all`);
        break;
      }
      
      case 'restrict-channel': {
        const [channel, ...ships] = args;
        if (!channel) {
          console.error('Usage: settings restrict-channel <channel-nest> [ships...]');
          process.exit(1);
        }
        await setChannelRule(channel, 'restricted', ships.length ? ships : undefined);
        console.log(`✓ Restricted ${channel}${ships.length ? ` to ${ships.join(', ')}` : ''}`);
        break;
      }
      
      case 'set-rule': {
        const [channel, mode, ...ships] = args;
        if (!channel || !mode || (mode !== 'open' && mode !== 'restricted')) {
          console.error('Usage: settings set-rule <channel-nest> <open|restricted> [ships...]');
          process.exit(1);
        }
        await setChannelRule(channel, mode as 'open' | 'restricted', ships.length ? ships : undefined);
        break;
      }
      
      case 'authorize-ship':
      case 'add-auth': {
        const [ship] = args;
        if (!ship) {
          console.error('Usage: settings authorize-ship <ship>');
          process.exit(1);
        }
        await addToArray('defaultAuthorizedShips', ship);
        break;
      }
      
      case 'deauthorize-ship':
      case 'remove-auth': {
        const [ship] = args;
        if (!ship) {
          console.error('Usage: settings deauthorize-ship <ship>');
          process.exit(1);
        }
        await removeFromArray('defaultAuthorizedShips', ship);
        break;
      }
      
      default:
        console.log(`Moltbot Settings Manager

Commands:
  get                              Show all settings
  set <key> <json>                 Set a setting value
  delete <key>                     Delete a setting
  
  allow-dm <ship>                  Add ship to DM allowlist
  remove-dm <ship>                 Remove ship from DM allowlist
  
  allow-channel <nest>             Add channel to watched list
  remove-channel <nest>            Remove channel from watched list
  
  open-channel <nest>              Set channel to open mode (anyone can interact)
  restrict-channel <nest> [ships]  Set channel to restricted mode
  
  authorize-ship <ship>            Add to default authorized ships
  deauthorize-ship <ship>          Remove from default authorized ships

Examples:
  npx ts-node scripts/settings.ts allow-dm ~nocsyx-lassul
  npx ts-node scripts/settings.ts open-channel chat/~nocsyx-lassul/bongtable
  npx ts-node scripts/settings.ts set showModelSig true
`);
    }
  } finally {
    await closeClient();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
