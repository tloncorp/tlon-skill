#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

function loadConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Ship config not found: ${filePath}`);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.url || !data.ship || !data.code) {
      throw new Error('Invalid config: must have url, ship, and code');
    }

    return {
      url: data.url,
      ship: data.ship.replace(/^~/, ''),
      code: data.code,
    };
  } catch (err) {
    if (err.message && (err.message.includes('Invalid config') || err.message.includes('not found'))) {
      throw err;
    }
    throw new Error(`Failed to parse config ${filePath}: ${err.message || err}`);
  }
}

function getConfigFromOpenClaw() {
  const configPaths = [
    process.env.OPENCLAW_CONFIG,
    path.join(os.homedir(), '.openclaw', 'openclaw.yaml'),
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    path.join(os.homedir(), '.clawdbot', 'moltbot.json'),
    path.join(os.homedir(), '.moltbot', 'moltbot.json'),
  ].filter(Boolean);

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const tlon = parsed && parsed.channels && parsed.channels.tlon;
      if (tlon && tlon.url && tlon.ship && tlon.code) {
        return {
          url: tlon.url,
          ship: tlon.ship.replace(/^~/, ''),
          code: tlon.code,
        };
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

function getConfig() {
  if (process.env.TLON_CONFIG_FILE) {
    return loadConfigFile(process.env.TLON_CONFIG_FILE);
  }

  const shipName = process.env.TLON_SHIP;
  const skillDir = process.env.TLON_SKILL_DIR;
  if (shipName && skillDir) {
    const shipFile = path.join(skillDir, 'ships', `${shipName.replace(/^~/, '')}.json`);
    return loadConfigFile(shipFile);
  }

  const url = process.env.URBIT_URL;
  const ship = process.env.URBIT_SHIP;
  const code = process.env.URBIT_CODE;
  if (url && ship && code) {
    return { url, ship: ship.replace(/^~/, ''), code };
  }

  const openclawConfig = getConfigFromOpenClaw();
  if (openclawConfig) {
    return openclawConfig;
  }

  throw new Error(
    'Missing Urbit config. Either:\n' +
      '  - Set TLON_CONFIG_FILE, or TLON_SHIP + TLON_SKILL_DIR, or\n' +
      '  - Set URBIT_URL, URBIT_SHIP, and URBIT_CODE environment variables, or\n' +
      '  - Configure Tlon channel in OpenClaw (~/.openclaw/openclaw.yaml)'
  );
}

async function main() {
  const channelId = process.argv[2]; // 'chat/~datler-rovder/v1vnak1d'
  
  if (!channelId) {
    console.error('Usage: node read-chat.js <channel-id>');
    process.exit(1);
  }

  try {
    const { configureClient, getChannelPosts } = await import('@tloncorp/api');
    const cfg = getConfig();

    configureClient({
      shipName: cfg.ship,
      shipUrl: cfg.url,
      getCode: async () => cfg.code,
    });

    const result = await getChannelPosts({
      channelId,
      mode: 'newest',
      count: 10,
      includeReplies: false,
    });

    console.log('Fetched posts:', result.posts.length);
    console.log('Newest 10 posts:');
    console.log(JSON.stringify(result.posts, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
