/**
 * tlon-run tool extension for Moltbot
 *
 * Registers the tlon_run tool that shells out to the tlon-run binary.
 * Install: copy to ~/.clawdbot/extensions/ or add to plugins.load.paths
 */

import { spawn } from "node:child_process";

function runTlonCommand(args) {
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
  });
}

export default {
  id: "tlon-run",
  name: "Tlon Run",
  description: "tlon_run tool for read-only Tlon API access",
  register(api) {
    api.registerTool({
      name: "tlon_run",
      description: "Read-only Tlon/Urbit API access. Use for checking activity, listing channels/groups, fetching message history, and looking up contacts. Commands: activity {mentions|replies|all|unreads} [--limit N], channels {dms|group-dms|groups|all}, contacts {list|self|get ~ship}, groups {list|info ~host/slug}, messages {dm ~ship|channel chat/~host/slug} [--limit N]",
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
          const args = params.command.trim().split(/\s+/);
          const output = await runTlonCommand(args);
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
