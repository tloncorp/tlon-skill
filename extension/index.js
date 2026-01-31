/**
 * tlon-run tool extension for Moltbot
 *
 * Registers the tlon_run tool that shells out to the tlon-run binary.
 * Install: copy to ~/.clawdbot/extensions/ or add to plugins.load.paths
 */

import { spawn } from "node:child_process";

const WORKSPACE_CMDS = new Set([
  "soul", "user", "tools", "agents", "bootstrap", "heartbeat", "identity", "memory",
]);

/**
 * Shell-like argument splitter: respects double and single quotes so that
 * `posts reply chat/~host/slug 12345 "Hello, this is my reply"` produces
 * ["posts", "reply", "chat/~host/slug", "12345", "Hello, this is my reply"]
 * instead of shattering the quoted string on whitespace.
 */
function shellSplit(str) {
  const args = [];
  let cur = "";
  let inDouble = false;
  let inSingle = false;
  let escape = false;

  for (const ch of str) {
    if (escape) { cur += ch; escape = false; continue; }
    if (ch === "\\" && !inSingle) { escape = true; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (/\s/.test(ch) && !inDouble && !inSingle) {
      if (cur) { args.push(cur); cur = ""; }
      continue;
    }
    cur += ch;
  }
  if (cur) args.push(cur);
  return args;
}

function runTlonCommand(args, stdin) {
  return new Promise((resolve, reject) => {
    const tlonRunPath = process.env.TLON_RUN_PATH || "/usr/local/bin/tlon-run";
    const child = spawn(tlonRunPath, args, {
      env: {
        ...process.env,
        TLON_SKILL_DIR: process.env.TLON_SKILL_DIR || "/usr/local/share/moltbot/skills/tlon",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to run tlon-run: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `tlon-run exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });

    if (stdin != null) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

/**
 * Parse a tlon-run command string into args + optional stdin.
 *
 * Uses shell-like quote parsing so that quoted strings (messages, content,
 * group names, etc.) survive as single arguments.
 *
 * Workspace write commands (replace/append) additionally pipe content via
 * stdin to handle large multiline markdown that may not be quoted.
 */
function parseCommand(raw) {
  const tokens = shellSplit(raw.trim());

  // Detect optional --ship prefix
  let start = 0;
  const shipArgs = [];
  if (tokens[0] === "--ship" && tokens.length > 1) {
    shipArgs.push(tokens[0], tokens[1]);
    start = 2;
  }

  const cmd = tokens[start] || "";

  if (WORKSPACE_CMDS.has(cmd)) {
    const sub = tokens[start + 1] || "";
    if (sub === "replace" || sub === "append") {
      // Content may be unquoted multiline — pipe via stdin
      const content = tokens[start + 2] || "";
      return { args: [...shipArgs, cmd, sub, "-"], stdin: content };
    }
    return { args: [...shipArgs, ...tokens.slice(start)], stdin: null };
  }

  return { args: [...shipArgs, ...tokens.slice(start)], stdin: null };
}

export default {
  id: "tlon-run",
  name: "Tlon Run",
  description: "tlon_run tool for read-only Tlon API access",
  register(api) {
    api.registerTool({
      name: "tlon_run",
      description: "Tlon/Urbit API access and workspace editing. Commands: activity {mentions|replies|all|unreads} [--limit N], channels {dms|group-dms|groups|all}, contacts {list|self|get ~ship}, groups {list|info ~host/slug}, messages {dm ~ship|channel chat/~host/slug} [--limit N], dms {send|reply|react|delete}, posts {send|reply|react|delete}, settings {get|set|delete}, click <op>. Workspace: soul|user|tools|agents|bootstrap|heartbeat|identity|memory {read|replace|append} [content]. Multiline content with markdown is fine for replace/append.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The tlon-run command and arguments. Examples: 'activity mentions --limit 10', 'channels dms', 'contacts get ~sampel-palnet', 'groups list', 'messages dm ~friend --limit 20'",
          },
        },
        required: ["command"],
      },
      async execute(_id, params) {
        try {
          const { args, stdin } = parseCommand(params.command);
          const output = await runTlonCommand(args, stdin);
          return {
            content: [{ type: "text", text: output }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    });
  },
};
