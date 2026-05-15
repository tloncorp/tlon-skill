import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const rootDir = resolve(process.cwd());
const cleanupPaths: string[] = [];

type RunContext = {
  tempRoot: string;
  home: string;
  cacheDir: string;
};

type RunOptions = {
  env?: Record<string, string>;
  prepare?: (context: RunContext) => {
    argsPrefix?: string[];
    cacheDir?: string;
    env?: Record<string, string>;
    cleanup?: () => void;
  } | void;
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanupPaths.push(dir);
  return dir;
}

function hermeticEnv(
  home: string,
  cacheDir: string,
  openclawConfig: string
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ["PATH", "SystemRoot", "WINDIR"]) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  env.HOME = home;
  env.TLON_CACHE_DIR = cacheDir;
  env.OPENCLAW_CONFIG = openclawConfig;
  return env;
}

async function runCli(args: string[], options: RunOptions = {}): Promise<CliResult> {
  const tempRoot = makeTempDir("tlon-hermetic-");
  const home = join(tempRoot, "home");
  const cacheDir = join(tempRoot, "cache");
  mkdirSync(home);
  mkdirSync(cacheDir);

  const context: RunContext = { tempRoot, home, cacheDir };
  const prepared = options.prepare?.(context) ?? {};
  const openclawConfig = join(home, "missing-openclaw.json");
  const env = {
    ...hermeticEnv(home, prepared.cacheDir ?? cacheDir, openclawConfig),
    ...prepared.env,
    ...options.env,
  };

  try {
    const proc = Bun.spawn(
      [
        process.execPath,
        "scripts/main.ts",
        ...(prepared.argsPrefix ?? []),
        ...args,
      ],
      {
        cwd: rootDir,
        env,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return { exitCode, stdout, stderr };
  } finally {
    prepared.cleanup?.();
  }
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    const dir = cleanupPaths.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function expectHelp(result: CliResult) {
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Usage:");
  expect(result.stderr).toBe("");
}

const helpCommands = [
  { name: "top-level", args: ["--help"] },
  { name: "upload", args: ["upload", "--help"] },
  { name: "activity", args: ["activity", "--help"] },
];

const hostileHelpVariants: Array<{
  name: string;
  prepare?: RunOptions["prepare"];
  env?: Record<string, string>;
}> = [
  {
    name: "nonexistent TLON_CONFIG_FILE",
    prepare: ({ home }) => ({
      env: { TLON_CONFIG_FILE: join(home, "missing-ship.json") },
    }),
  },
  {
    name: "CLI --config /nonexistent",
    prepare: ({ home }) => ({
      argsPrefix: ["--config", join(home, "missing-ship.json")],
    }),
  },
  {
    name: "invalid OPENCLAW_CONFIG",
    prepare: ({ home }) => {
      const configPath = join(home, "invalid-openclaw.json");
      writeFileSync(configPath, "{not-json");
      return { env: { OPENCLAW_CONFIG: configPath } };
    },
  },
  {
    name: "multiple cached ships",
    prepare: ({ cacheDir }) => {
      writeFileSync(
        join(cacheDir, "zod.json"),
        JSON.stringify({
          url: "https://zod.example",
          ship: "zod",
          cookie: "urbauth-~zod=fake",
        })
      );
      writeFileSync(
        join(cacheDir, "bus.json"),
        JSON.stringify({
          url: "https://bus.example",
          ship: "bus",
          cookie: "urbauth-~bus=fake",
        })
      );
    },
  },
  {
    name: "unwritable cache path",
    prepare: ({ tempRoot }) => {
      const cacheDir = join(tempRoot, "unwritable-cache");
      mkdirSync(cacheDir);
      chmodSync(cacheDir, 0o500);
      return {
        cacheDir,
        cleanup: () => chmodSync(cacheDir, 0o700),
      };
    },
  },
];

describe("CLI hermetic subprocess behavior", () => {
  it("prints source CLI version without host credentials", async () => {
    const result = await runCli(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("dev\n");
    expect(result.stderr).toBe("");
  });

  for (const command of helpCommands) {
    for (const variant of hostileHelpVariants) {
      it(`prints ${command.name} help with ${variant.name}`, async () => {
        const result = await runCli(command.args, {
          env: variant.env,
          prepare: variant.prepare,
        });

        expectHelp(result);
      });
    }
  }

  it("reports unknown commands without reading credentials", async () => {
    const result = await runCli(["definitely-not-a-command"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown command: definitely-not-a-command");
    expect(result.stderr).toContain('Run "tlon --help" for usage information.');
  });
});
