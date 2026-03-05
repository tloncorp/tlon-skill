/**
 * API client setup for CLI usage
 * Config resolution + @tloncorp/api client initialization
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { configureClient, preSig, subscribe, Urbit, client } from "@tloncorp/api";

export interface UrbitConfig {
  url: string;
  ship: string;
  /** Access code (required unless cookie is provided/cached) */
  code: string;
  /** Pre-authenticated cookie (optional, bypasses code-based auth) */
  cookie?: string;
}

interface CachedAuth {
  url: string;
  ship: string;
  cookie: string;
  cachedAt: number;
}

let initialized = false;
let subscribed = false;
let cachedConfig: UrbitConfig | null = null;

/**
 * Get the cache directory, configurable via TLON_CACHE_DIR env var
 */
function getCacheDir(): string {
  return process.env.TLON_CACHE_DIR || path.join(os.homedir(), ".tlon", "cache");
}

// Track if user provided explicit credentials (for helpful warnings)
let userProvidedCode = false;
let userProvidedUrl = false;

/**
 * Get path to cookie cache file for a ship
 */
function getCachePath(ship: string): string {
  return path.join(getCacheDir(), `${ship.replace(/^~/, "")}.json`);
}

/**
 * Get all cached ship entries
 */
function getCachedShips(): CachedAuth[] {
  try {
    const cacheDir = getCacheDir();
    if (!fs.existsSync(cacheDir)) return [];
    
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
    const entries: CachedAuth[] = [];
    
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(cacheDir, file), "utf-8"));
        if (data.url && data.ship && data.cookie) {
          entries.push(data);
        }
      } catch {
        // Skip invalid cache files
      }
    }
    
    return entries;
  } catch {
    return [];
  }
}

/**
 * Get cached cookie for a ship+url combo
 */
function getCachedCookie(url: string, ship: string): string | null {
  try {
    const cachePath = getCachePath(ship);
    if (!fs.existsSync(cachePath)) return null;
    
    const data: CachedAuth = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    
    // Verify URL matches (don't use cookie meant for different host)
    if (data.url !== url) return null;
    
    return data.cookie || null;
  } catch {
    return null;
  }
}

/**
 * Get cached entry for a ship (any url)
 */
function getCachedEntry(ship: string): CachedAuth | null {
  try {
    const cachePath = getCachePath(ship);
    if (!fs.existsSync(cachePath)) return null;
    
    const data: CachedAuth = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    if (data.url && data.ship && data.cookie) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache cookie for future use
 */
function cacheCookie(url: string, ship: string, cookie: string): void {
  try {
    fs.mkdirSync(getCacheDir(), { recursive: true, mode: 0o700 });
    const cachePath = getCachePath(ship);
    const data: CachedAuth = {
      url,
      ship: ship.replace(/^~/, ""),
      cookie,
      cachedAt: Date.now(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Parse ship name from auth cookie.
 * Cookie format: urbauth-~ship=0v...
 */
function parseShipFromCookie(cookie: string): string | null {
  const match = cookie.match(/urbauth-~?([a-z-]+)=/);
  return match ? match[1] : null;
}

/**
 * Try to read Tlon credentials from OpenClaw config
 */
function getConfigFromOpenClaw(): UrbitConfig | null {
  const configPaths = [
    process.env.OPENCLAW_CONFIG,
    path.join(os.homedir(), ".openclaw", "openclaw.yaml"),
    path.join(os.homedir(), ".openclaw", "openclaw.json"),
    path.join(os.homedir(), ".clawdbot", "moltbot.json"),
    path.join(os.homedir(), ".moltbot", "moltbot.json"),
  ].filter(Boolean) as string[];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;

      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);

      const tlon = parsed?.channels?.tlon;
      if (tlon?.url && (tlon?.code || tlon?.cookie)) {
        if (tlon.url.includes("${")) continue;
        if (tlon.code?.includes("${") || tlon.cookie?.includes("${")) continue;
        if (tlon.ship?.includes("${")) continue;

        let ship = tlon.ship?.replace(/^~/, "");
        if (!ship && tlon.cookie) {
          ship = parseShipFromCookie(tlon.cookie);
        }
        if (!ship) continue;

        return {
          url: tlon.url,
          ship,
          code: tlon.code || "",
          cookie: tlon.cookie,
        };
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Get config from ship file or environment
 *
 * Priority:
 * 1. TLON_CONFIG_FILE env var (direct path to config file)
 * 2. Cookie-based auth (URL + COOKIE, ship derived from cookie)
 * 3. Cache lookup (if SHIP provided, checks TLON_CACHE_DIR or ~/.tlon/cache)
 * 4. Code-based auth (URL + SHIP + CODE) - fallback if cache miss
 * 5. TLON_SHIP + TLON_SKILL_DIR (loads ships/<ship>.json)
 * 6. OpenClaw config (~/.openclaw/openclaw.yaml)
 * 7. Cached ships (if exactly one cached, use it)
 */
export function getConfig(): UrbitConfig {
  if (cachedConfig) return cachedConfig;

  const configFile = process.env.TLON_CONFIG_FILE;
  if (configFile) {
    cachedConfig = loadConfigFile(configFile);
    return cachedConfig;
  }

  const url = process.env.URBIT_URL || process.env.TLON_URL;
  const shipEnv = process.env.URBIT_SHIP || process.env.TLON_SHIP;
  const cookie = process.env.URBIT_COOKIE || process.env.TLON_COOKIE;
  const code = process.env.URBIT_CODE || process.env.TLON_CODE;

  // Track what user provided for later warnings
  userProvidedUrl = !!url;
  userProvidedCode = !!code;

  // Cookie-based auth (URL + COOKIE)
  if (url && cookie) {
    const ship = shipEnv?.replace(/^~/, "") || parseShipFromCookie(cookie);
    if (ship) {
      cachedConfig = { url, ship, code: code || "", cookie };
      return cachedConfig;
    }
  }

  // Check cache first if ship is provided (before code-based auth)
  // This allows passing URL/SHIP/CODE as fallback while preferring cached cookies
  if (shipEnv) {
    const cached = getCachedEntry(shipEnv.replace(/^~/, ""));
    if (cached) {
      cachedConfig = { url: cached.url, ship: cached.ship, code: code || "", cookie: cached.cookie };
      return cachedConfig;
    }
  }

  // Code-based auth (URL + SHIP + CODE) - fallback if cache miss
  if (url && shipEnv && code) {
    cachedConfig = { url, ship: shipEnv.replace(/^~/, ""), code };
    return cachedConfig;
  }

  // Ship + skill dir (loads ships/<ship>.json)
  const skillDir = process.env.TLON_SKILL_DIR;
  if (shipEnv && skillDir) {
    cachedConfig = loadConfigFile(path.join(skillDir, "ships", `${shipEnv.replace(/^~/, "")}.json`));
    return cachedConfig;
  }

  // OpenClaw config
  const openclawConfig = getConfigFromOpenClaw();
  if (openclawConfig) {
    cachedConfig = openclawConfig;
    return cachedConfig;
  }

  // Cached ships fallback
  const cachedShips = getCachedShips();
  if (cachedShips.length === 1) {
    const entry = cachedShips[0];
    cachedConfig = { url: entry.url, ship: entry.ship, code: "", cookie: entry.cookie };
    return cachedConfig;
  }
  if (cachedShips.length > 1) {
    const shipList = cachedShips.map(s => `  ~${s.ship}`).join("\n");
    throw new Error(
      `Multiple cached ships found. Specify which with --ship:\n${shipList}`
    );
  }

  throw new Error(
    "Missing Urbit config. Either:\n" +
      "  - Use CLI flags: --config <file>, or --url + --cookie, or --url + --ship + --code\n" +
      "  - Use --ship with a previously cached ship\n" +
      "  - Set URBIT_URL + URBIT_COOKIE, or URBIT_URL + URBIT_SHIP + URBIT_CODE\n" +
      "  - Configure Tlon channel in OpenClaw (~/.openclaw/openclaw.yaml)"
  );
}

function loadConfigFile(filePath: string): UrbitConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Ship config not found: ${filePath}`);
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    if (!data.url) {
      throw new Error(`Invalid config: must have url`);
    }

    if (!data.code && !data.cookie) {
      throw new Error(`Invalid config: must have code or cookie`);
    }

    let ship = data.ship?.replace(/^~/, "");
    if (!ship && data.cookie) {
      ship = parseShipFromCookie(data.cookie);
    }
    if (!ship) {
      throw new Error(`Invalid config: must have ship (or cookie with ship in name)`);
    }

    return {
      url: data.url,
      ship,
      code: data.code || "",
      cookie: data.cookie,
    };
  } catch (err: any) {
    if (err.message.includes("Invalid config") || err.message.includes("not found")) {
      throw err;
    }
    throw new Error(`Failed to parse config ${filePath}: ${err.message}`);
  }
}

/**
 * Set up subscriptions required for trackedPoke to receive acks.
 * Only subscribes to requested apps to minimize overhead.
 */
async function setupSubscriptions(subs: Array<'groups' | 'channels' | 'chat' | 'lanyard'>): Promise<void> {
  if (subscribed) return;

  if (subs.includes('groups')) {
    await subscribe({ app: 'groups', path: '/v1/groups' }, () => {});
  }

  if (subs.includes('channels')) {
    await subscribe({ app: 'channels', path: '/v2' }, () => {});
  }

  if (subs.includes('chat')) {
    await subscribe({ app: 'chat', path: '/' }, () => {});
  }

  if (subs.includes('lanyard')) {
    await subscribe({ app: 'lanyard', path: '/v1/records' }, () => {});
  }

  subscribed = true;
}

/**
 * Ensure @tloncorp/api client is configured, connected, and subscribed.
 * Pass required subscription apps to minimize connection overhead.
 */
export async function ensureClient(subs: Array<'groups' | 'channels' | 'chat' | 'lanyard'> = []): Promise<UrbitConfig> {
  const cfg = getConfig();
  
  if (!initialized) {
    // Determine cookie to use: explicit > cached > none (use code)
    let cookieToUse = cfg.cookie || getCachedCookie(cfg.url, cfg.ship);
    let usedCachedCookie = !cfg.cookie && !!cookieToUse;
    let didFreshAuth = false;
    
    if (cookieToUse) {
      // Cookie-based auth
      const urbit = new Urbit(cfg.url);
      urbit.cookie = cookieToUse;
      urbit.nodeId = preSig(cfg.ship);
      
      await configureClient({
        shipName: cfg.ship,
        shipUrl: cfg.url,
        client: urbit,
        getCode: cfg.code ? async () => cfg.code : undefined,
      });
      
      // Warn if user passed credentials that weren't needed
      if (usedCachedCookie && userProvidedCode) {
        const cachedShips = getCachedShips();
        if (cachedShips.length === 1) {
          console.error(`Note: Using cached credentials for ~${cfg.ship}. You can just run: tlon <command>`);
        } else {
          console.error(`Note: Using cached credentials for ~${cfg.ship}. You can just run: tlon --ship ~${cfg.ship} <command>`);
        }
      }
    } else if (cfg.code) {
      // Code-based auth (first time)
      await configureClient({
        shipName: cfg.ship,
        shipUrl: cfg.url,
        getCode: async () => cfg.code,
      });
      didFreshAuth = true;
    } else {
      throw new Error("No cookie or code available for authentication");
    }
    
    // Cache the cookie for future invocations
    if (client.cookie) {
      cacheCookie(cfg.url, cfg.ship, client.cookie);
      
      // Notify on first auth that credentials are now cached
      if (didFreshAuth) {
        const cachedShips = getCachedShips();
        if (cachedShips.length === 1) {
          console.error(`Note: Credentials cached for ~${cfg.ship}. Next time just run: tlon <command>`);
        } else {
          console.error(`Note: Credentials cached for ~${cfg.ship}. Next time run: tlon --ship ~${cfg.ship} <command>`);
        }
      }
    }
    
    await setupSubscriptions(subs);
    initialized = true;
  }
  
  return cfg;
}

/**
 * Get current ship name (with ~)
 */
export async function getCurrentShip(): Promise<string> {
  const cfg = await ensureClient([]);
  return preSig(cfg.ship);
}

/**
 * Normalize ship name to include ~
 */
export function normalizeShip(ship: string): string {
  return preSig(ship);
}
