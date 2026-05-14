#!/usr/bin/env node
/**
 * Bump version in all package.json files
 * Usage: node scripts/bump-version.js <version>
 * Example: node scripts/bump-version.js 0.1.5
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const packageFiles = [
  "package.json",
  "npm/darwin-arm64/package.json",
  "npm/darwin-x64/package.json",
  "npm/linux-x64/package.json",
  "npm/linux-arm64/package.json",
];

const packageLockFile = "package-lock.json";
const tlonSkillPackagePrefix = "@tloncorp/tlon-skill-";

const newVersion = process.argv[2];

if (!newVersion) {
  // Read current version
  const mainPkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
  console.log(`Current version: ${mainPkg.version}`);
  console.log("\nUsage: node scripts/bump-version.js <version>");
  console.log("Example: node scripts/bump-version.js 0.1.5");
  process.exit(0);
}

// Validate version format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid version format: ${newVersion}`);
  console.error("Expected format: X.Y.Z or X.Y.Z-tag");
  process.exit(1);
}

console.log(`Bumping version to ${newVersion}...\n`);

function getTlonSkillOptionalDeps(optionalDependencies) {
  if (!optionalDependencies) {
    return [];
  }

  return Object.keys(optionalDependencies).filter((dep) =>
    dep.startsWith(tlonSkillPackagePrefix)
  );
}

function updateTlonSkillOptionalDeps(optionalDependencies) {
  for (const dep of getTlonSkillOptionalDeps(optionalDependencies)) {
    optionalDependencies[dep] = newVersion;
  }
}

for (const file of packageFiles) {
  const filePath = join(rootDir, file);
  try {
    const pkg = JSON.parse(readFileSync(filePath, "utf-8"));
    const oldVersion = pkg.version;
    pkg.version = newVersion;

    // Also update optionalDependencies versions in main package.json
    if (file === "package.json") {
      updateTlonSkillOptionalDeps(pkg.optionalDependencies);
    }

    writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`  ${file}: ${oldVersion} → ${newVersion}`);
  } catch (err) {
    console.error(`  ${file}: ERROR - ${err.message}`);
  }
}

try {
  const filePath = join(rootDir, packageLockFile);
  const packageLock = JSON.parse(readFileSync(filePath, "utf-8"));
  const oldVersion = packageLock.version;
  packageLock.version = newVersion;

  const rootPackage = packageLock.packages?.[""];
  if (rootPackage) {
    rootPackage.version = newVersion;
    updateTlonSkillOptionalDeps(rootPackage.optionalDependencies);
  }

  if (packageLock.packages) {
    const platformPackagePaths = new Set(
      getTlonSkillOptionalDeps(rootPackage?.optionalDependencies).map(
        (dep) => `node_modules/${dep}`
      )
    );

    for (const packagePath of Object.keys(packageLock.packages)) {
      if (packagePath.startsWith(`node_modules/${tlonSkillPackagePrefix}`)) {
        if (platformPackagePaths.has(packagePath)) {
          packageLock.packages[packagePath] = { optional: true };
        } else {
          delete packageLock.packages[packagePath];
        }
      }
    }

    // npm 11 requires lock entries for optional deps. These packages publish
    // after the bump PR merges, so use placeholders instead of old tarballs.
    for (const packagePath of platformPackagePaths) {
      packageLock.packages[packagePath] = { optional: true };
    }
  }

  writeFileSync(filePath, JSON.stringify(packageLock, null, 2) + "\n");
  console.log(`  ${packageLockFile}: ${oldVersion} → ${newVersion}`);
} catch (err) {
  console.error(`  ${packageLockFile}: ERROR - ${err.message}`);
}

console.log("\nDone! Don't forget to:");
console.log("  1. Update CHANGELOG.md (if you have one)");
console.log("  2. Commit the changes");
console.log("  3. Tag the release: git tag v" + newVersion);
console.log("  4. Push: git push && git push --tags");
