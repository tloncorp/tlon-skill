import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const rootDir = resolve(process.cwd());
const binaryPath = join(rootDir, "dist", "tlon-run");
const packageJson = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf-8")
) as { version: string };

type SmokeCase = {
  name: string;
  args: string[];
  expectedStdout?: string;
  stdoutIncludes?: string;
};

function hermeticEnv(tempRoot: string): Record<string, string> {
  const home = join(tempRoot, "home");
  const cacheDir = join(tempRoot, "cache");
  mkdirSync(home);
  mkdirSync(cacheDir);

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

  const env: Record<string, string> = {};
  for (const key of ["PATH", "SystemRoot", "WINDIR"]) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  env.HOME = home;
  env.TLON_CACHE_DIR = cacheDir;
  env.OPENCLAW_CONFIG = join(home, "missing-openclaw.json");
  env.TLON_CONFIG_FILE = join(home, "missing-ship.json");
  return env;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertSmokeCase(testCase: SmokeCase): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "tlon-build-smoke-"));
  try {
    const result = spawnSync(binaryPath, testCase.args, {
      cwd: rootDir,
      env: hermeticEnv(tempRoot),
      encoding: "utf-8",
    });

    if (result.error) {
      fail(`${testCase.name}: failed to run binary: ${result.error.message}`);
    }
    if (result.status !== 0) {
      fail(
        `${testCase.name}: expected exit 0, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );
    }
    if (result.stderr !== "") {
      fail(`${testCase.name}: expected empty stderr, got:\n${result.stderr}`);
    }
    if (
      testCase.expectedStdout !== undefined &&
      result.stdout !== testCase.expectedStdout
    ) {
      fail(
        `${testCase.name}: unexpected stdout\nexpected:\n${testCase.expectedStdout}\nactual:\n${result.stdout}`
      );
    }
    if (
      testCase.stdoutIncludes !== undefined &&
      !result.stdout.includes(testCase.stdoutIncludes)
    ) {
      fail(
        `${testCase.name}: stdout did not include ${JSON.stringify(testCase.stdoutIncludes)}\nstdout:\n${result.stdout}`
      );
    }

    console.log(`ok - ${testCase.name}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

for (const testCase of [
  {
    name: "tlon-run --version",
    args: ["--version"],
    expectedStdout: `${packageJson.version}\n`,
  },
  {
    name: "tlon-run upload --help",
    args: ["upload", "--help"],
    stdoutIncludes: "Usage: upload",
  },
  {
    name: "tlon-run activity --help",
    args: ["activity", "--help"],
    stdoutIncludes: "Usage: activity",
  },
] satisfies SmokeCase[]) {
  assertSmokeCase(testCase);
}
