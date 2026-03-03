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
import { poke, scry, subscribe, unsubscribe } from "@tloncorp/api";
import { Atom, jam } from "@urbit/nockjs";
import { render } from "@urbit/aura";
import { ensureClient } from "./api-client";
import { getOption, hasFlag } from "./cli-utils";

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



function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type HookTemplateType = "on-post" | "cron" | "moderation" | "bare";

function getHookTemplate(name: string, type: HookTemplateType): string {
  const safeName = name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "my-hook";

  if (type === "cron") {
    return `:: ${safeName} (${type})
:: Deletes posts older than configured delay on cron ticks
:: Config: delay (default ~m30 = 30 minutes)
|=  [=event:h bowl:h]
^-  outcome:h
=-  &+[[[%allowed event] -] state.hook]
?.  ?=(%cron -.event)  ~
^-  (list effect:h)
=+  ;;(delay=@dr (~(gut by config) 'delay' ~m30))
=/  cutoff  (sub now delay)
?~  channel  ~
%+  murn
  (tap:on-v-posts:c (lot:on-v-posts:c posts.u.channel ~ \`cutoff))
|=  [=id-post:c post=(may:c v-post:c)]
^-  (unit effect:h)
?:  ?=(%| -.post)  ~
\`[%channels %channel nest.u.channel %post %del id-post]
`;
  }

  if (type === "moderation") {
    return `:: ${safeName} (${type})
:: Blocks posts containing configured words
:: Config: blocked (comma-separated), reason
|=  [=event:h =bowl:h]
^-  outcome:h
=+  ;;(blocked=cord (~(gut by config.bowl) 'blocked' 'spam,scam'))
=+  ;;(reason=cord (~(gut by config.bowl) 'reason' 'Message contains blocked content'))
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
=/  text=tape
  (trip (flatten content.post.event))
=/  bad=(list tape)
  %+  turn
    (rash blocked (more com (star ;~(less com prn))))
  trip
=/  has-bad=?
  %+  lien  bad
  |=  w=tape
  !=(~ (find w text))
?:  has-bad
  &+[[[%denied (some reason)] ~] state.hook.bowl]
&+[[[%allowed event] ~] state.hook.bowl]
`;
  }

  if (type === "bare") {
    return `:: ${safeName} (${type})
|=  [=event:h =bowl:h]
^-  outcome:h
&+[[[%allowed event] ~] state.hook.bowl]
`;
  }

  return `:: ${safeName} (${type})
:: Reacts to new posts with configurable emoji
:: Config: emoji (default 👍)
|=  [=event:h =bowl:h]
^-  outcome:h
=+  ;;(emoji=cord (~(gut by config.bowl) 'emoji' '👍'))
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
?:  =(author.post.event our.bowl)
  &+[[[%allowed event] ~] state.hook.bowl]
?~  channel.bowl
  &+[[[%allowed event] ~] state.hook.bowl]
=/  react-effect=effect:h
  :*  %channels
      %channel
      nest.u.channel.bowl
      [%post [%add-react id.post.event our.bowl emoji]]
  ==
&+[[[%allowed event] [react-effect ~]] state.hook.bowl]
`;
}

function initHookTemplate(name: string, type: HookTemplateType, outPath?: string, force: boolean = false): void {
  const path = outPath || `./${name.replace(/\s+/g, "-").toLowerCase()}.hoon`;
  if (fs.existsSync(path) && !force) {
    console.error(`Refusing to overwrite existing file: ${path}`);
    console.error("Use --force to overwrite.");
    process.exit(1);
  }
  const src = getHookTemplate(name, type);
  fs.writeFileSync(path, src, "utf-8");
  console.log(`✅ Created ${type} hook template: ${path}`);
  console.log("Next: edit the file, then run: tlon hooks add <name> <file>");
}

async function pokeAndWaitForHooksUpdate(
  actionName: string,
  json: Record<string, any>,
  timeoutMs: number = 5000
): Promise<void> {
  let settled = false;
  let resolveUpdate: ((value: any) => void) | null = null;

  const waitForUpdate = new Promise<any>((resolve) => {
    resolveUpdate = resolve;
  });

  const subId = await subscribe<any>(
    { app: "channels-server", path: "/v0/hooks" },
    (update) => {
      if (settled) return;
      settled = true;
      resolveUpdate?.(update);
    }
  );

  try {
    await poke({
      app: "channels-server",
      mark: "hook-action-0",
      json,
    });

    const timeoutPromise = sleep(timeoutMs).then(() => ({ __timeout: true }));
    const result = await Promise.race([waitForUpdate, timeoutPromise]);

    if (result?.__timeout) {
      console.log(`⚠️ ${actionName} sent, but timed out waiting for hooks update (${timeoutMs}ms).`);
      return;
    }

    console.log(`[hooks update] ${JSON.stringify(result, null, 2)}`);

    const text = JSON.stringify(result).toLowerCase();
    if (text.includes("error") || text.includes("fail") || text.includes("compile")) {
      console.log("⚠️ Update may contain an error/compile issue.");
    }
  } finally {
    settled = true;
    await unsubscribe(subId);
  }
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
  
  await pokeAndWaitForHooksUpdate("add", {
    add: {
      name,
      src,
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
  if (!options.name && !options.srcPath) {
    console.error("Error: At least one of --name or --src is required");
    process.exit(1);
  }

  const hooks = await scry<Hooks>({ app: "channels-server", path: "/v0/hooks" });
  const existing = hooks.hooks[id];

  if (!existing) {
    console.error(`Hook not found: ${id}`);
    process.exit(1);
  }

  const edit: Record<string, any> = {
    id,
    name: options.name ?? existing.name,
    meta: existing.meta ?? {},
    src: existing.src,
  };

  if (options.srcPath) {
    if (!fs.existsSync(options.srcPath)) {
      console.error(`Source file not found: ${options.srcPath}`);
      process.exit(1);
    }
    edit.src = fs.readFileSync(options.srcPath, "utf-8");
  }

  console.log(`Editing hook ${id}...`);

  await pokeAndWaitForHooksUpdate("edit", { edit });

  console.log(`✅ Hook ${id} updated.`);
}

// Delete a hook
async function deleteHook(id: string): Promise<void> {
  console.log(`Deleting hook ${id}...`);
  
  await pokeAndWaitForHooksUpdate("delete", {
    del: id,
  });
  
  console.log(`✅ Hook ${id} deleted.`);
}

// Set execution order for a channel
async function setOrder(nest: string, ids: string[]): Promise<void> {
  console.log(`Setting hook order for ${nest}...`);
  
  await pokeAndWaitForHooksUpdate("order", {
    order: {
      nest,
      seq: ids,
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
  
  // Convert config values to jammed @uw encoded nouns
  const jammedConfig: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    // Convert string value to cord (atom) and jam it
    const cord = Atom.fromCord(value);
    jammedConfig[key] = render('uw', jam(cord).number);
  }
  
  await pokeAndWaitForHooksUpdate("config", {
    config: {
      id,
      nest,
      config: jammedConfig,
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
  
  await pokeAndWaitForHooksUpdate("cron", {
    cron: {
      id,
      origin: origin || null,
      schedule,
      config: {},
    },
  });
  
  console.log(`✅ Hook ${id} scheduled with interval ${schedule}`);
}

// Stop a cron job
async function restHook(id: string, origin?: string): Promise<void> {
  console.log(`Stopping cron for hook ${id}...`);
  
  await pokeAndWaitForHooksUpdate("rest", {
    rest: {
      id,
      origin: origin || null,
    },
  });
  
  console.log(`✅ Cron stopped for hook ${id}`);
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await ensureClient();

  switch (command) {
    case "init": {
      const name = args[1];
      if (!name) {
        console.error("Usage: hooks.ts init <name> [--type on-post|cron|moderation|bare] [--out <file>] [--force]");
        process.exit(1);
      }
      const typeRaw = (getOption(args, "type") || "on-post") as HookTemplateType;
      if (!["on-post", "cron", "moderation", "bare"].includes(typeRaw)) {
        console.error(`Invalid --type: ${typeRaw}. Expected one of: on-post, cron, moderation, bare`);
        process.exit(1);
      }
      const out = getOption(args, "out");
      const force = hasFlag(args, "force");
      initHookTemplate(name, typeRaw, out, force);
      break;
    }

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
  init <name> [--type] [--out]      Create a starter hook template
  list                              List all hooks
  get <id>                          Get hook details and source
  add <name> <src-file>             Add a new hook from file
  edit <id> [--name] [--src]        Edit hook name or source
  delete <id>                       Delete a hook
  order <nest> <id1> [id2...]       Set execution order for channel
  config <id> <nest> <key=value...> Configure hook for channel (values are nouns serialized as text)
  cron <id> <schedule> [--nest]     Schedule periodic execution
  rest <id> [--nest]                Stop a cron job

Hook IDs are @uv format (e.g., 0v1a.2b3c4...)
Schedule is @dr format (e.g., ~h1 for 1 hour, ~m30 for 30 minutes)

Examples:
  tlon hooks init my-hook --type on-post
  tlon hooks add my-hook ./my-hook.hoon
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
