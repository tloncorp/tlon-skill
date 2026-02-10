#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Map of platform+arch to package name
const PLATFORMS = {
  "darwin-arm64": "@tloncorp/tlon-skill-darwin-arm64",
  "darwin-x64": "@tloncorp/tlon-skill-darwin-x64",
  "linux-x64": "@tloncorp/tlon-skill-linux-x64",
};

function getBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;
  const key = `${platform}-${arch}`;

  // Check for local binary (dev mode)
  const localBinary = join(__dirname, "tlon");
  if (existsSync(localBinary)) {
    return localBinary;
  }

  const packageName = PLATFORMS[key];
  if (!packageName) {
    console.error(`Unsupported platform: ${platform}-${arch}`);
    console.error(`Supported platforms: ${Object.keys(PLATFORMS).join(", ")}`);
    process.exit(1);
  }

  try {
    // Try to resolve the platform-specific package
    const packagePath = require.resolve(`${packageName}/package.json`);
    const binaryPath = join(dirname(packagePath), "tlon-run");
    
    if (!existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`);
    }
    
    return binaryPath;
  } catch (err) {
    console.error(`Failed to find binary for ${platform}-${arch}`);
    console.error(`Package ${packageName} may not be installed.`);
    console.error(`Try: npm install ${packageName}`);
    process.exit(1);
  }
}

const binaryPath = getBinaryPath();
const args = process.argv.slice(2);

const result = spawnSync(binaryPath, args, {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`Failed to run binary: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
