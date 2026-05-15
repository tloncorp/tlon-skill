import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  CLI_MATRIX_CASES,
  COMMAND_FAMILIES,
  type CliCase,
  normalizeCliOutput,
} from "../../scripts/cli-test-matrix";

const rootDir = resolve(process.cwd());
const cleanupPaths: string[] = [];
const CLI_TIMEOUT_MS = 15_000;

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

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, CLI_TIMEOUT_MS);

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timeout);

    if (timedOut) {
      throw new Error(`CLI timed out after ${CLI_TIMEOUT_MS}ms: ${args.join(" ")}`);
    }

    return {
      exitCode,
      stdout: normalizeCliOutput(stdout),
      stderr: normalizeCliOutput(stderr),
    };
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

function expectCliCase(result: CliResult, testCase: CliCase) {
  expect(result.exitCode).toBe(testCase.expectedExitCode);

  if (testCase.stdout !== undefined) {
    expect(result.stdout).toBe(testCase.stdout);
  }
  for (const expected of testCase.stdoutIncludes ?? []) {
    expect(result.stdout).toContain(expected);
  }
  for (const unexpected of testCase.stdoutExcludes ?? []) {
    expect(result.stdout).not.toContain(unexpected);
  }

  if (testCase.stderr !== undefined) {
    expect(result.stderr).toBe(testCase.stderr);
  }
  for (const expected of testCase.stderrIncludes ?? []) {
    expect(result.stderr).toContain(expected);
  }
  for (const unexpected of testCase.stderrExcludes ?? []) {
    expect(result.stderr).not.toContain(unexpected);
  }
}

const hostileHelpCommands = [
  { name: "top-level", args: ["--help"] },
  ...COMMAND_FAMILIES.map((family) => ({
    name: family,
    args: [family, "--help"],
  })),
];

describe("CLI hermetic subprocess behavior", () => {
  it("prints source CLI version without host credentials", async () => {
    const result = await runCli(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("dev\n");
    expect(result.stderr).toBe("");
  });

  for (const testCase of CLI_MATRIX_CASES) {
    it(testCase.name, async () => {
      const result = await runCli(testCase.args);
      expectCliCase(result, testCase);
    });
  }

  for (const command of hostileHelpCommands) {
    it(`prints ${command.name} help with nonexistent TLON_CONFIG_FILE`, async () => {
      const result = await runCli(command.args, {
        prepare: ({ home }) => ({
          env: { TLON_CONFIG_FILE: join(home, "missing-ship.json") },
        }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stderr).toBe("");
    });

    it(`prints ${command.name} help with CLI --config /nonexistent`, async () => {
      const result = await runCli(command.args, {
        prepare: ({ home }) => ({
          argsPrefix: ["--config", join(home, "missing-ship.json")],
        }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stderr).toBe("");
    });
  }
});
