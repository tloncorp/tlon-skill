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
 * Workspace write commands (e.g. "soul replace <content>") need special
 * handling: the content after the subcommand is a single blob that may
 * contain spaces and newlines, so we pipe it via stdin instead of passing
 * it as a positional arg (which would be shattered by whitespace splitting).
 */
function parseCommand(raw) {
  const trimmed = raw.trim();

  // Detect optional --ship prefix
  let rest = trimmed;
  const shipArgs = [];
  if (rest.startsWith("--ship ")) {
    const parts = rest.split(/\s+/);
    shipArgs.push(parts[0], parts[1]); // --ship ~name
    rest = parts.slice(2).join(" ");
  }

  const tokens = rest.split(/\s+/);
  const cmd = tokens[0] || "";

  if (WORKSPACE_CMDS.has(cmd)) {
    const sub = tokens[1] || "";
    if (sub === "replace" || sub === "append") {
      // Everything after "cmd sub " is content — pass via stdin
      const prefixLen = rest.indexOf(sub) + sub.length;
      const content = rest.slice(prefixLen).replace(/^\s+/, "");
      return { args: [...shipArgs, cmd, sub, "-"], stdin: content || "" };
    }
    // read or unknown sub — no content
    return { args: [...shipArgs, ...tokens], stdin: null };
  }

  // Non-workspace commands: plain whitespace split
  return { args: [...shipArgs, ...tokens], stdin: null };
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
