/**
 * API client setup for CLI usage
 * Config resolution + @tloncorp/api client initialization
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { configureClient, preSig, subscribe, Urbit } from "@tloncorp/api";

export interface UrbitConfig {
  url: string;
  ship: string;
  code: string;
}

let initialized = false;
let connectedInitialized = false;
let cachedConfig: UrbitConfig | null = null;
let connectedUrbit: Urbit | null = null;

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
      if (tlon?.url && tlon?.ship && tlon?.code) {
        // Skip if values look like unexpanded env var templates
        if (tlon.url.includes("${") || tlon.ship.includes("${") || tlon.code.includes("${")) {
          continue;
        }
        return {
          url: tlon.url,
          ship: tlon.ship.replace(/^~/, ""),
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
 * Get config from ship file or environment
 *
 * Priority:
 * 1. TLON_CONFIG_FILE env var (direct path to config file, set by --config)
 * 2. URBIT or TLON env vars (URL + SHIP + CODE, all three required)
 * 3. TLON_SHIP + TLON_SKILL_DIR (loads ships/<ship>.json)
 * 4. OpenClaw config (~/.openclaw/openclaw.yaml)
 */
export function getConfig(): UrbitConfig {
  if (cachedConfig) return cachedConfig;

  // Option 1: Direct config file path (--config flag or TLON_CONFIG_FILE)
  const configFile = process.env.TLON_CONFIG_FILE;
  if (configFile) {
    cachedConfig = loadConfigFile(configFile);
    return cachedConfig;
  }

  // Option 2: Explicit env vars (--url/--ship/--code flags or URBIT_*/TLON_* env vars)
  // All three must be present
  const url = process.env.URBIT_URL || process.env.TLON_URL;
  const ship = process.env.URBIT_SHIP || process.env.TLON_SHIP;
  const code = process.env.URBIT_CODE || process.env.TLON_CODE;

  if (url && ship && code) {
    cachedConfig = { url, ship: ship.replace(/^~/, ""), code };
    return cachedConfig;
  }

  // Option 3: Ship name + skill dir (loads ships/<ship>.json)
  const shipName = process.env.TLON_SHIP;
  const skillDir = process.env.TLON_SKILL_DIR;
  if (shipName && skillDir) {
    const shipFile = path.join(skillDir, "ships", `${shipName.replace(/^~/, "")}.json`);
    cachedConfig = loadConfigFile(shipFile);
    return cachedConfig;
  }

  // Option 4: OpenClaw config
  const openclawConfig = getConfigFromOpenClaw();
  if (openclawConfig) {
    cachedConfig = openclawConfig;
    return cachedConfig;
  }

  throw new Error(
    "Missing Urbit config. Either:\n" +
      "  - Use CLI flags: --config <file>, or --url + --ship + --code, or\n" +
      "  - Set TLON_CONFIG_FILE, or TLON_SHIP + TLON_SKILL_DIR, or\n" +
      "  - Set URBIT_URL/TLON_URL, URBIT_SHIP/TLON_SHIP, and URBIT_CODE/TLON_CODE env vars, or\n" +
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

    if (!data.url || !data.ship || !data.code) {
      throw new Error(`Invalid config: must have url, ship, and code`);
    }

    return {
      url: data.url,
      ship: data.ship.replace(/^~/, ""),
      code: data.code,
    };
  } catch (err: any) {
    if (err.message.includes("Invalid config") || err.message.includes("not found")) {
      throw err;
    }
    throw new Error(`Failed to parse config ${filePath}: ${err.message}`);
  }
}

/**
 * Ensure @tloncorp/api client is configured
 */
export function ensureClient(): UrbitConfig {
  const cfg = getConfig();
  if (!initialized) {
    configureClient({
      shipName: cfg.ship,
      shipUrl: cfg.url,
      getCode: async () => cfg.code
    });
    initialized = true;
  }
  return cfg;
}

/**
 * Get current ship name (with ~)
 */
export function getCurrentShip(): string {
  const cfg = ensureClient();
  return preSig(cfg.ship);
}

/**
 * Normalize ship name to include ~
 */
export function normalizeShip(ship: string): string {
  return preSig(ship);
}

/**
 * Ensure @tloncorp/api client is configured with an active connection
 * and subscribed to paths required for trackedPoke.
 * 
 * The connected client maintains SSE subscriptions which allow
 * trackedPoke to receive acknowledgments for mutations.
 */
export async function ensureConnectedClient(): Promise<UrbitConfig> {
  const cfg = getConfig();
  
  if (!connectedInitialized) {
    // Create and connect the Urbit client
    connectedUrbit = new Urbit(cfg.url, cfg.code);
    // Set ship identity (not typed but works at runtime)
    (connectedUrbit as any).ship = cfg.ship;
    
    await connectedUrbit.connect();
    
    // Configure the API with the connected client
    configureClient({
      shipName: cfg.ship,
      shipUrl: cfg.url,
      getCode: async () => cfg.code,
      client: connectedUrbit,
    });
    
    // Subscribe to paths required for trackedPoke to receive acks
    // Groups subscription - for group mutations
    await subscribe(
      { app: 'groups', path: '/v1/groups' },
      () => {} // We don't need to handle events, just need the subscription active
    );
    
    // Channels subscription - for channel mutations
    await subscribe(
      { app: 'channels', path: '/v2' },
      () => {} // We don't need to handle events, just need the subscription active
    );
    
    connectedInitialized = true;
    initialized = true; // Also mark as initialized for reads
  }
  
  return cfg;
}

/**
 * Disconnect the active client connection.
 * Call this when done with mutations to clean up.
 */
export function disconnectClient(): void {
  if (connectedUrbit) {
    try {
      // Reset the connection state
      connectedUrbit.reset();
    } catch {
      // Ignore reset errors
    }
    connectedUrbit = null;
    connectedInitialized = false;
  }
}
