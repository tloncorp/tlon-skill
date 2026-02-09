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

import { getConfig, type UrbitConfig } from "./urbit-client";
import type {
  ClientParams,
  ConfigureClientFn,
  UploadFileFn,
} from "@tloncorp/api/api" with { "resolution-mode": "import" };

type TlonApiModule = {
  configureClient: ConfigureClientFn;
  uploadFile: UploadFileFn;
};

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

// @tloncorp/api is ESM-only, so it must be loaded lazily from this CommonJS package.
async function loadApi(): Promise<TlonApiModule> {
  const api = await import("@tloncorp/api/api");
  const maybeApi = api as {
    configureClient?: unknown;
    uploadFile?: unknown;
  };

  if (typeof maybeApi.configureClient !== "function" || typeof maybeApi.uploadFile !== "function") {
    throw new Error("Invalid @tloncorp/api module shape");
  }

  return {
    configureClient: maybeApi.configureClient as TlonApiModule["configureClient"],
    uploadFile: maybeApi.uploadFile as UploadFileFn,
  };
}

function getClientParams(config: UrbitConfig): ClientParams {
  return {
    shipUrl: config.url,
    shipName: config.ship.replace(/^~/, ""),
    verbose: false,
    getCode: async () => config.code,
  };
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  return response.blob();
}

export async function uploadImageFromUrl(
  imageUrl: string,
  uploadFile: UploadFileFn,
): Promise<string> {
  const blob = await fetchImageBlob(imageUrl);
  const result = await uploadFile({
    blob,
    contentType: blob.type || DEFAULT_CONTENT_TYPE,
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

  configureClient(getClientParams(config));

  const uploadedUrl = await uploadImageFromUrl(url, uploadFile);
  console.log(uploadedUrl);
}

main().catch((err) => {
  console.error(`error: ${err.message || err}`);
  process.exit(1);
});
