/**
 * API client setup for CLI usage
 * Config resolution + @tloncorp/api client initialization
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { configureClient, preSig } from "@tloncorp/api";

export interface UrbitConfig {
  url: string;
  ship: string;
  code: string;
}

let initialized = false;
let cachedConfig: UrbitConfig | null = null;

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
 * 1. TLON_CONFIG_FILE env var (direct path to config file)
 * 2. TLON_SHIP + TLON_SKILL_DIR (loads ships/<ship>.json)
 * 3. URBIT_URL/URBIT_SHIP/URBIT_CODE env vars
 * 4. OpenClaw config (~/.openclaw/openclaw.yaml)
 */
export function getConfig(): UrbitConfig {
  if (cachedConfig) return cachedConfig;

  // Option 1: Direct config file path
  const configFile = process.env.TLON_CONFIG_FILE;
  if (configFile) {
    cachedConfig = loadConfigFile(configFile);
    return cachedConfig;
  }

  // Option 2: Ship name + skill dir
  const shipName = process.env.TLON_SHIP;
  const skillDir = process.env.TLON_SKILL_DIR;
  if (shipName && skillDir) {
    const shipFile = path.join(skillDir, "ships", `${shipName.replace(/^~/, "")}.json`);
    cachedConfig = loadConfigFile(shipFile);
    return cachedConfig;
  }

  // Option 3: Legacy env vars
  const url = process.env.URBIT_URL;
  const ship = process.env.URBIT_SHIP;
  const code = process.env.URBIT_CODE;

  if (url && ship && code) {
    cachedConfig = { url, ship: ship.replace(/^~/, ""), code };
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
      "  - Set TLON_CONFIG_FILE, or TLON_SHIP + TLON_SKILL_DIR, or\n" +
      "  - Set URBIT_URL, URBIT_SHIP, and URBIT_CODE environment variables, or\n" +
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
      getCode: async () => cfg.code,
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
