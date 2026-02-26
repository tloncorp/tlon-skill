#!/usr/bin/env npx ts-node
/**
 * Hooks API for Tlon
 *
 * Hooks are functions that run on channel triggers (posts, replies, reactions, crons)
 * and can produce effects and maintain state.
 *
 * Usage:
 *   npx ts-node scripts/hooks.ts list                              # List all hooks
 *   npx ts-node scripts/hooks.ts get <id>                          # Get a specific hook
 *   npx ts-node scripts/hooks.ts add <name> <src-file>             # Add a new hook
 *   npx ts-node scripts/hooks.ts edit <id> [--name] [--src]        # Edit a hook
 *   npx ts-node scripts/hooks.ts delete <id>                       # Delete a hook
 *   npx ts-node scripts/hooks.ts order <nest> <id1> [id2...]       # Set execution order
 *   npx ts-node scripts/hooks.ts config <id> <nest> <key=value...> # Configure for channel
 *   npx ts-node scripts/hooks.ts cron <id> <schedule> [--nest]     # Schedule periodic run
 *   npx ts-node scripts/hooks.ts rest <id> [--nest]                # Stop a cron job
 */

import * as fs from "fs";
import { poke, scry } from "@tloncorp/api";
import { ensureClient } from "./api-client";

// Types based on sur/hooks.hoon
interface Hook {
  id: string;
  version: string;
  name: string;
  meta: Record<string, any>;
  src: string;
  compiled: boolean;
  config: Record<string, Record<string, string>>;
}

interface Job {
  hook: string;
  schedule: { next: string; repeat: string };
  config: Record<string, string>;
}

interface Hooks {
  hooks: Record<string, Hook>;
  order: Record<string, string[]>;
  crons: Record<string, Record<string, Job>>;
}

// List all hooks
async function listHooks(): Promise<void> {
  const hooks = await scry<Hooks>({ app: "channels-server", path: "/v0/hooks" });
  
  console.log("\n=== HOOKS ===\n");
  
  const hookList = Object.values(hooks.hooks);
  if (hookList.length === 0) {
    console.log("No hooks found.");
    return;
  }
  
  for (const hook of hookList) {
    console.log(`📎 ${hook.name}`);
    console.log(`   ID: ${hook.id}`);
    console.log(`   Compiled: ${hook.compiled ? "✓" : "✗"}`);
    
    const configChannels = Object.keys(hook.config);
    if (configChannels.length > 0) {
      console.log(`   Configured for: ${configChannels.join(", ")}`);
    }
    console.log("");
  }
  
  // Show cron jobs
  const cronEntries = Object.entries(hooks.crons);
  if (cronEntries.length > 0) {
    console.log("=== CRON JOBS ===\n");
    for (const [hookId, origins] of cronEntries) {
      const hook = hooks.hooks[hookId];
      for (const [origin, job] of Object.entries(origins)) {
        console.log(`⏰ ${hook?.name || hookId}`);
        console.log(`   Origin: ${origin === "global" ? "global" : origin}`);
        console.log(`   Next: ${job.schedule.next}`);
        console.log(`   Repeat: ${job.schedule.repeat}`);
        console.log("");
      }
    }
  }
}

// Get a specific hook
async function getHook(id: string): Promise<void> {
  const hooks = await scry<Hooks>({ app: "channels-server", path: "/v0/hooks" });
  const hook = hooks.hooks[id];
  
  if (!hook) {
    console.error(`Hook not found: ${id}`);
    process.exit(1);
  }
  
  console.log(`\n=== ${hook.name} ===\n`);
  console.log(`ID: ${hook.id}`);
  console.log(`Version: ${hook.version}`);
  console.log(`Compiled: ${hook.compiled ? "✓" : "✗"}`);
  
  if (Object.keys(hook.meta).length > 0) {
    console.log(`Meta: ${JSON.stringify(hook.meta)}`);
  }
  
  console.log("\n--- Source ---");
  console.log(hook.src);
  
  const configChannels = Object.entries(hook.config);
  if (configChannels.length > 0) {
    console.log("\n--- Config ---");
    for (const [nest, cfg] of configChannels) {
      console.log(`  ${nest}:`);
      for (const [key, val] of Object.entries(cfg)) {
        console.log(`    ${key}: ${val}`);
      }
    }
  }
}

// Add a new hook
async function addHook(name: string, srcPath: string): Promise<void> {
  if (!fs.existsSync(srcPath)) {
    console.error(`Source file not found: ${srcPath}`);
    process.exit(1);
  }
  
  const src = fs.readFileSync(srcPath, "utf-8");
  
  console.log(`Adding hook "${name}"...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: {
      add: {
        name,
        src,
      },
    },
  });
  
  console.log(`✅ Hook "${name}" added.`);
  console.log("   Note: Check compilation status with 'hooks list'");
}

// Edit a hook
async function editHook(
  id: string,
  options: { name?: string; srcPath?: string }
): Promise<void> {
  const edit: Record<string, any> = { id };
  
  if (options.name) {
    edit.name = options.name;
  }
  
  if (options.srcPath) {
    if (!fs.existsSync(options.srcPath)) {
      console.error(`Source file not found: ${options.srcPath}`);
      process.exit(1);
    }
    edit.src = fs.readFileSync(options.srcPath, "utf-8");
  }
  
  if (!options.name && !options.srcPath) {
    console.error("Error: At least one of --name or --src is required");
    process.exit(1);
  }
  
  console.log(`Editing hook ${id}...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: { edit },
  });
  
  console.log(`✅ Hook ${id} updated.`);
}

// Delete a hook
async function deleteHook(id: string): Promise<void> {
  console.log(`Deleting hook ${id}...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: {
      del: id,
    },
  });
  
  console.log(`✅ Hook ${id} deleted.`);
}

// Set execution order for a channel
async function setOrder(nest: string, ids: string[]): Promise<void> {
  console.log(`Setting hook order for ${nest}...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: {
      order: {
        nest,
        seq: ids,
      },
    },
  });
  
  console.log(`✅ Hook order set: ${ids.join(" → ")}`);
}

// Configure a hook for a channel
async function configHook(
  id: string,
  nest: string,
  config: Record<string, string>
): Promise<void> {
  console.log(`Configuring hook ${id} for ${nest}...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: {
      config: {
        id,
        nest,
        config,
      },
    },
  });
  
  console.log(`✅ Hook ${id} configured for ${nest}`);
}

// Schedule a cron job
async function cronHook(
  id: string,
  schedule: string,
  origin?: string
): Promise<void> {
  console.log(`Scheduling hook ${id}...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: {
      cron: {
        id,
        origin: origin || null,
        schedule,
        config: {},
      },
    },
  });
  
  console.log(`✅ Hook ${id} scheduled with interval ${schedule}`);
}

// Stop a cron job
async function restHook(id: string, origin?: string): Promise<void> {
  console.log(`Stopping cron for hook ${id}...`);
  
  await poke({
    app: "channels-server",
    mark: "hook-action-0",
    json: {
      rest: {
        id,
        origin: origin || null,
      },
    },
  });
  
  console.log(`✅ Cron stopped for hook ${id}`);
}

// Parse command line options
function getOption(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await ensureClient();

  switch (command) {
    case "list":
      await listHooks();
      break;

    case "get": {
      const id = args[1];
      if (!id) {
        console.error("Usage: hooks.ts get <id>");
        process.exit(1);
      }
      await getHook(id);
      break;
    }

    case "add": {
      const name = args[1];
      const srcPath = args[2];
      if (!name || !srcPath) {
        console.error("Usage: hooks.ts add <name> <src-file>");
        process.exit(1);
      }
      await addHook(name, srcPath);
      break;
    }

    case "edit": {
      const id = args[1];
      if (!id) {
        console.error("Usage: hooks.ts edit <id> [--name <name>] [--src <file>]");
        process.exit(1);
      }
      const name = getOption(args, "name");
      const srcPath = getOption(args, "src");
      await editHook(id, { name, srcPath });
      break;
    }

    case "delete":
    case "del": {
      const id = args[1];
      if (!id) {
        console.error("Usage: hooks.ts delete <id>");
        process.exit(1);
      }
      await deleteHook(id);
      break;
    }

    case "order": {
      const nest = args[1];
      const ids = args.slice(2).filter((a) => !a.startsWith("--"));
      if (!nest || ids.length === 0) {
        console.error("Usage: hooks.ts order <nest> <id1> [id2...]");
        process.exit(1);
      }
      await setOrder(nest, ids);
      break;
    }

    case "config": {
      const id = args[1];
      const nest = args[2];
      const configPairs = args.slice(3).filter((a) => !a.startsWith("--"));
      if (!id || !nest || configPairs.length === 0) {
        console.error("Usage: hooks.ts config <id> <nest> <key=value...>");
        process.exit(1);
      }
      const config: Record<string, string> = {};
      for (const pair of configPairs) {
        const [key, ...valueParts] = pair.split("=");
        config[key] = valueParts.join("=");
      }
      await configHook(id, nest, config);
      break;
    }

    case "cron": {
      const id = args[1];
      const schedule = args[2];
      if (!id || !schedule) {
        console.error("Usage: hooks.ts cron <id> <schedule> [--nest <nest>]");
        console.error("  schedule: @dr format like ~h1 (1 hour) or ~m30 (30 minutes)");
        process.exit(1);
      }
      const nest = getOption(args, "nest");
      await cronHook(id, schedule, nest);
      break;
    }

    case "rest": {
      const id = args[1];
      if (!id) {
        console.error("Usage: hooks.ts rest <id> [--nest <nest>]");
        process.exit(1);
      }
      const nest = getOption(args, "nest");
      await restHook(id, nest);
      break;
    }

    default:
      console.log(`Usage: hooks.ts <command>

Commands:
  list                              List all hooks
  get <id>                          Get hook details and source
  add <name> <src-file>             Add a new hook from file
  edit <id> [--name] [--src]        Edit hook name or source
  delete <id>                       Delete a hook
  order <nest> <id1> [id2...]       Set execution order for channel
  config <id> <nest> <key=value...> Configure hook for channel
  cron <id> <schedule> [--nest]     Schedule periodic execution
  rest <id> [--nest]                Stop a cron job

Hook IDs are @uv format (e.g., 0v1a.2b3c4...)
Schedule is @dr format (e.g., ~h1 for 1 hour, ~m30 for 30 minutes)

Examples:
  tlon hooks add my-hook ./hook.hoon
  tlon hooks config 0v1a.2b3c4 chat/~host/channel key1=value1 key2=value2
  tlon hooks cron 0v1a.2b3c4 ~h1 --nest chat/~host/channel
`);
      process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
