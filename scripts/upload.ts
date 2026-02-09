#!/usr/bin/env npx ts-node

/**
 * Upload an image from a URL to Tlon storage
 *
 * Usage:
 *   npx ts-node scripts/upload.ts <image-url>
 *
 * Examples:
 *   npx ts-node scripts/upload.ts https://example.com/image.png
 */

import { getConfig } from "./urbit-client.js";

// @tloncorp/api is ESM-only; dynamic import preserves as real import() with module=Node16
async function loadApi(): Promise<{
  configureClient: (params: {
    shipUrl: string;
    shipName: string;
    verbose: boolean;
    getCode: () => Promise<string>;
  }) => void;
  uploadFile: (params: { blob: Blob; contentType: string }) => Promise<{ url: string }>;
}> {
  return await import("@tloncorp/api") as any;
}

export async function uploadImageFromUrl(
  uploadFile: (opts: { blob: Blob; contentType: string }) => Promise<{ url: string }>,
  imageUrl: string,
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  const result = await uploadFile({
    blob,
    contentType: blob.type || "application/octet-stream",
  });

  return result.url;
}

async function main() {
  const url = process.argv[2];

  if (!url || url === "--help" || url === "-h") {
    console.log(`Usage: upload <image-url>

Fetches an image from a URL and uploads it to Tlon storage.
Outputs the uploaded URL on success.

Examples:
  tlon-run upload https://example.com/image.png
  tlon-run upload https://httpbin.org/image/png`);
    process.exit(url ? 0 : 1);
  }

  const config = getConfig();
  const { configureClient, uploadFile } = await loadApi();

  configureClient({
    shipUrl: config.url,
    shipName: config.ship.replace(/^~/, ""),
    verbose: false,
    getCode: async () => config.code,
  });

  const uploadedUrl = await uploadImageFromUrl(uploadFile, url);
  console.log(uploadedUrl);
}

main().catch((err) => {
  console.error(`error: ${err.message || err}`);
  process.exit(1);
});
