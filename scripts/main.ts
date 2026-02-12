#!/usr/bin/env bun
/**
 * tlon-run - Unified CLI for Tlon/Urbit operations
 *
 * Usage:
 *   tlon-run [--ship ~name] <command> <subcommand> [args...]
 *
 * Commands:
 *   activity     Activity/notifications (mentions, replies, all, unreads)
 *   channels     Channel listing and management
 *   contacts     Contact/profile management
 *   dms          Direct message operations
 *   groups       Group management
 *   messages     Message history and search
 *   notebook     Post to diary/notebook channels
 *   posts        Post reactions, edits, deletes
 *   settings     OpenClaw settings management
 */

const VERSION = "2.0.0";

function printHelp() {
  console.log(`tlon-run v${VERSION} - Tlon/Urbit CLI

Usage:
  tlon-run [--ship ~name] <command> <subcommand> [args...]

Commands:
  activity     Activity/notifications (mentions, replies, all, unreads)
  channels     Channel listing and management (dms, groups, all, info, update, delete)
  contacts     Contact/profile management (list, get, self, sync, add, remove, update-profile)
  dms          Direct message operations (send, reply, react, unreact, delete, accept, decline)
  groups       Group management (list, create, info, invite, join, leave, delete, ...)
  messages     Message history and search (dm, channel, history, search)
  notebook     Post to diary/notebook channels
  posts        Post reactions, edits, deletes (react, unreact, edit, delete)
  settings     OpenClaw settings management (get, set, delete, allow-dm, ...)
  upload       Upload an image from URL to Tlon storage

Options:
  --ship ~name   Select which ship to use (sets TLON_SHIP env var)
  --help, -h     Show this help
  --version, -v  Show version

Examples:
  tlon-run contacts list
  tlon-run messages dm ~sampel-palnet --limit 10
  tlon-run groups create "My Group" --description "A cool group"
  tlon-run posts react chat/~host/channel 170.141.184... 👍
  tlon-run --ship ~zod contacts self
`);
}

async function main() {
  const rawArgs = process.argv.slice(2);

  // Handle --ship flag before command
  let shipOverride: string | null = null;
  const args: string[] = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--ship" && rawArgs[i + 1]) {
      shipOverride = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--ship=")) {
      shipOverride = arg.split("=", 2)[1] || "";
      continue;
    }
    args.push(arg);
  }

  if (shipOverride) {
    process.env.TLON_SHIP = shipOverride.replace(/^~/, "");
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
  // Scripts expect: [node, script, subcommand, ...args]
  const scriptArgs = args.slice(1);
  process.argv = ["tlon-run", command, ...scriptArgs];

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
      case "groups": {
        const mod = await import("./groups");
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
        console.error('Run "tlon-run --help" for usage information.');
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
