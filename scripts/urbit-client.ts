/**
 * Urbit HTTP API client for CLI usage
 * Uses direct fetch with cookie auth (same approach as Tlon plugin)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UrbitConfig {
  url: string;
  ship: string;
  code: string;
}

let config: UrbitConfig | null = null;
let authCookie: string | null = null;

/**
 * Try to read Tlon credentials from Moltbot config
 */
function getConfigFromMoltbot(): UrbitConfig | null {
  // Check common Moltbot config locations
  const configPaths = [
    process.env.MOLTBOT_CONFIG,
    path.join(os.homedir(), '.clawdbot', 'moltbot.json'),
    path.join(os.homedir(), '.moltbot', 'moltbot.json'),
  ].filter(Boolean) as string[];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      
      const tlon = parsed?.channels?.tlon;
      if (tlon?.url && tlon?.ship && tlon?.code) {
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

/**
 * Get config from environment variables, or fall back to Moltbot config
 */
export function getConfig(): UrbitConfig {
  // 1. Check environment variables first
  const url = process.env.URBIT_URL;
  const ship = process.env.URBIT_SHIP;
  const code = process.env.URBIT_CODE;

  if (url && ship && code) {
    return { url, ship: ship.replace(/^~/, ""), code };
  }

  // 2. Fall back to Moltbot config
  const moltbotConfig = getConfigFromMoltbot();
  if (moltbotConfig) {
    return moltbotConfig;
  }

  throw new Error(
    "Missing Urbit config. Either:\n" +
    "  - Set URBIT_URL, URBIT_SHIP, and URBIT_CODE environment variables, or\n" +
    "  - Configure Tlon channel in Moltbot (~/.clawdbot/moltbot.json)"
  );
}

/**
 * Authenticate and get session cookie
 */
async function authenticate(): Promise<string> {
  if (authCookie) return authCookie;

  config = getConfig();
  
  const resp = await fetch(`${config.url}/~/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `password=${config.code}`,
  });

  if (!resp.ok) {
    throw new Error(`Login failed with status ${resp.status}`);
  }

  const cookie = resp.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("No auth cookie received");
  }

  // Extract just the urbauth cookie
  const match = cookie.match(/urbauth-[^=]+=([^;]+)/);
  authCookie = match ? cookie.split(";")[0] : cookie.split(";")[0];
  
  return authCookie;
}

/**
 * Scry (read) from an agent
 */
export async function scry<T>(params: {
  app: string;
  path: string;
}): Promise<T> {
  const cookie = await authenticate();
  const cfg = config!;
  
  const url = `${cfg.url}/~/scry/${params.app}${params.path}.json`;
  
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Scry failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

/**
 * Poke (write) to an agent
 */
export async function poke(params: {
  app: string;
  mark: string;
  json: any;
}): Promise<void> {
  const cookie = await authenticate();
  const cfg = config!;
  
  // Generate a unique channel ID
  const channelId = `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channelUrl = `${cfg.url}/~/channel/${channelId}`;
  
  // Open channel and send poke
  const pokeReq = {
    id: 1,
    action: "poke",
    ship: cfg.ship,
    app: params.app,
    mark: params.mark,
    json: params.json,
  };

  const resp = await fetch(channelUrl, {
    method: "PUT",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([pokeReq]),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Poke failed (${resp.status}): ${text}`);
  }

  // Delete the channel
  const deleteReq = {
    id: 2,
    action: "delete",
  };

  await fetch(channelUrl, {
    method: "PUT",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([deleteReq]),
  }).catch(() => {
    // Ignore cleanup errors
  });
}

/**
 * Cleanup - not needed with this approach but kept for API compatibility
 */
export async function closeClient(): Promise<void> {
  authCookie = null;
  config = null;
}

/**
 * Get current ship name (with ~)
 */
export function getCurrentShip(): string {
  const cfg = config || getConfig();
  return cfg.ship.startsWith("~") ? cfg.ship : `~${cfg.ship}`;
}

/**
 * Normalize ship name to include ~
 */
export function normalizeShip(ship: string): string {
  return ship.startsWith("~") ? ship : `~${ship}`;
}
