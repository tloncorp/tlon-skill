#!/usr/bin/env node

/**
 * Build script for all platforms.
 * Run locally to build for current platform only.
 * CI runs this on each platform's runner.
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const platform = process.platform;
const arch = process.arch;
const target = `${platform}-${arch}`;

console.log(`Building for ${target}...`);

// Build the binary
const distDir = join(rootDir, "dist");
mkdirSync(distDir, { recursive: true });

const binaryName = platform === "win32" ? "tlon.exe" : "tlon";
const binaryPath = join(distDir, binaryName);

execSync(`bun build scripts/main.ts --compile --outfile ${binaryPath}`, {
  cwd: rootDir,
  stdio: "inherit",
});

// Copy to the appropriate npm package directory
const npmDir = join(rootDir, "npm", target);
cpSync(binaryPath, join(npmDir, binaryName));

console.log(`Built and copied to npm/${target}/${binaryName}`);
