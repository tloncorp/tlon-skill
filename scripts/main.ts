#!/usr/bin/env bun
/**
 * tlon - Unified CLI for Tlon/Urbit operations
 *
 * Usage:
 *   tlon [options] <command> <subcommand> [args...]
 *
 * Commands:
 *   activity     Activity/notifications (mentions, replies, all, unreads)
 *   channels     Channel listing and management
 *   contacts     Contact/profile management
 *   dms          Direct message operations
 *   groups       Group management
 *   messages     Message history and search (dm, channel, history, search, context, post)
 *   notebook     Post to diary/notebook channels
 *   posts        Post reactions, edits, deletes
 *   settings     OpenClaw settings management
 */

// Version is injected at build time via --define
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

function printHelp() {
  console.log(`tlon v${VERSION} - Tlon/Urbit CLI

Usage:
  tlon [options] <command> <subcommand> [args...]

Commands:
  activity     Activity/notifications (mentions, replies, all, unreads)
  channels     Channel listing and management (dms, groups, info, update, delete, add/del-writers, add/del-readers)
  contacts     Contact/profile management (list, get, self, sync, add, remove, update-profile)
  dms          Direct message operations (send, reply, react, unreact, delete, accept, decline)
  expose       Manage public content exposure (list, show, hide, check, url)
  groups       Group management (list, create, info, invite, join, leave, delete, ...)
  hooks        Channel hooks management (list, add, edit, delete, order, config, cron, rest)
  messages     Message history and search (dm, channel, history, search, context, post)
  notebook     Post to diary/notebook channels
  posts        Post reactions, edits, deletes (react, unreact, edit, delete)
  settings     OpenClaw settings management (get, set, delete, allow-dm, ...)
  upload       Upload a file from URL, local path, or stdin

Credential Options (override defaults):
  --config <file>   Path to JSON config file with url + cookie or url + ship + code
  --url <url>       Ship URL (e.g., https://your-ship.tlon.network)
  --ship <~name>    Ship name (uses cached credentials if available)
  --code <code>     Access code (e.g., sampel-ticlyt-migfun-falmel)
  --cookie <cookie> Pre-authenticated cookie (ship is parsed from cookie name)

Other Options:
  --help, -h     Show this help
  --version, -v  Show version

Config Resolution (first match wins):
  1. CLI flags (--config, or --url + --cookie, or --url + --ship + --code)
  2. TLON_CONFIG_FILE env var
  3. URBIT_URL + URBIT_COOKIE (ship derived from cookie)
  4. URBIT_URL + URBIT_SHIP + URBIT_CODE
  5. --ship with cached credentials (no url/code needed)
  6. TLON_SHIP + TLON_SKILL_DIR (loads ships/<ship>.json)
  7. OpenClaw config (~/.openclaw/openclaw.yaml)
  8. Cached ships (auto-select if only one)

Examples:
  tlon contacts list
  tlon messages dm ~sampel-palnet --limit 10
  tlon groups create "My Group" --description "A cool group"
  tlon posts react chat/~host/channel 170.141.184... 👍
  tlon --config ~/ships/zod.json contacts self
  tlon --url https://zod.tlon.network --cookie "urbauth-~zod=0v..." contacts self
  tlon --url https://zod.tlon.network --ship ~zod --code abcd-efgh-ijkl-mnop contacts self
`);
}

async function main() {
  const rawArgs = process.argv.slice(2);

  // Parse credential flags before command
  let urlOverride: string | null = null;
  let shipOverride: string | null = null;
  let codeOverride: string | null = null;
  let cookieOverride: string | null = null;
  let configOverride: string | null = null;
  const args: string[] = [];

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    // --config
    if (arg === "--config" && rawArgs[i + 1]) {
      configOverride = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--config=")) {
      configOverride = arg.split("=", 2)[1] || "";
      continue;
    }

    // --url
    if (arg === "--url" && rawArgs[i + 1]) {
      urlOverride = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--url=")) {
      urlOverride = arg.split("=", 2)[1] || "";
      continue;
    }

    // --ship
    if (arg === "--ship" && rawArgs[i + 1]) {
      shipOverride = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--ship=")) {
      shipOverride = arg.split("=", 2)[1] || "";
      continue;
    }

    // --code
    if (arg === "--code" && rawArgs[i + 1]) {
      codeOverride = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--code=")) {
      codeOverride = arg.split("=", 2)[1] || "";
      continue;
    }

    // --cookie
    if (arg === "--cookie" && rawArgs[i + 1]) {
      cookieOverride = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--cookie=")) {
      cookieOverride = arg.split("=", 2)[1] || "";
      continue;
    }

    args.push(arg);
  }

  // Apply credential overrides
  if (configOverride) {
    process.env.TLON_CONFIG_FILE = configOverride;
  } else if (urlOverride && cookieOverride) {
    // URL + cookie: ship derived from cookie (or explicit --ship)
    process.env.URBIT_URL = urlOverride;
    process.env.URBIT_COOKIE = cookieOverride;
    if (shipOverride) {
      process.env.URBIT_SHIP = shipOverride.replace(/^~/, "");
    }
    if (codeOverride) {
      process.env.URBIT_CODE = codeOverride;
    }
  } else if (urlOverride && shipOverride && codeOverride) {
    // URL + ship + code: traditional auth
    process.env.URBIT_URL = urlOverride;
    process.env.URBIT_SHIP = shipOverride.replace(/^~/, "");
    process.env.URBIT_CODE = codeOverride;
  } else if (shipOverride && !urlOverride && !codeOverride && !cookieOverride) {
    // Only --ship: set TLON_SHIP for cache lookup or ships/ directory
    process.env.TLON_SHIP = shipOverride.replace(/^~/, "");
  } else if (urlOverride || codeOverride || cookieOverride) {
    // Partial flags - set what we have (allows merging with env vars)
    if (urlOverride) process.env.URBIT_URL = urlOverride;
    if (shipOverride) process.env.URBIT_SHIP = shipOverride.replace(/^~/, "");
    if (codeOverride) process.env.URBIT_CODE = codeOverride;
    if (cookieOverride) process.env.URBIT_COOKIE = cookieOverride;
  }

  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    process.exit(0);
  }

  // Rewrite process.argv so scripts see their args correctly
  const scriptArgs = args.slice(1);
  process.argv = ["tlon", command, ...scriptArgs];

  try {
    switch (command) {
      case "activity": {
        const mod = await import("./activity");
        break;
      }
      case "channels": {
        const mod = await import("./channels");
        break;
      }
      case "contacts": {
        const mod = await import("./contacts");
        break;
      }
      case "dms": {
        const mod = await import("./dms");
        break;
      }
      case "expose": {
        const mod = await import("./expose");
        break;
      }
      case "groups": {
        const mod = await import("./groups");
        break;
      }
      case "hooks": {
        const mod = await import("./hooks");
        break;
      }
      case "messages": {
        const mod = await import("./messages");
        break;
      }
      case "notebook": {
        const mod = await import("./notebook-post");
        break;
      }
      case "posts": {
        const mod = await import("./posts");
        break;
      }
      case "settings": {
        const mod = await import("./settings");
        break;
      }
      case "upload": {
        const mod = await import("./upload");
        await mod.main(scriptArgs);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "tlon --help" for usage information.');
        process.exit(1);
    }
  } catch (error: any) {
    if (error.message?.includes("Missing Urbit config")) {
      console.error("Error:", error.message);
    } else {
      console.error("Error:", error.message || error);
    }
    process.exit(1);
  }
}

main();
