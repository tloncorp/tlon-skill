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

import { getConfig, scry, getCurrentShip } from "./urbit-client";

const MEMEX_BASE_URL = "https://memex.tlon.network";

const mimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

interface StorageConfiguration {
  currentBucket: string;
  region: string;
  publicUrlBase: string;
  service: string;
  presignedUrl: string;
}

interface StorageCredentials {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function getExtensionFromMimeType(mimeType?: string): string {
  if (!mimeType) return ".jpg";
  return mimeToExt[mimeType.toLowerCase()] || ".jpg";
}

async function getMemexUploadUrl(params: {
  contentLength: number;
  contentType: string;
  fileName: string;
}): Promise<{ hostedUrl: string; uploadUrl: string }> {
  const ship = getCurrentShip().replace(/^~/, "");
  const token = await scry<string>({ app: "genuine", path: "/secret" });

  const endpoint = `${MEMEX_BASE_URL}/v1/${ship}/upload`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...params }),
  });

  if (!response.ok) {
    throw new Error(`Memex upload request failed: ${response.status}`);
  }

  const data: { url?: string; filePath?: string } | null = await response.json();
  if (!data?.url || !data?.filePath) {
    throw new Error("Invalid response from Memex");
  }

  return { hostedUrl: data.filePath, uploadUrl: data.url };
}

export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  const contentType = blob.type || "application/octet-stream";
  const extension = getExtensionFromMimeType(contentType);

  const ship = getCurrentShip().replace(/^~/, "");
  const timestamp = Date.now();
  const fileKey = `${ship}/${timestamp}-upload${extension}`;

  const config = await scry<{ "storage-update": { configuration: StorageConfiguration } }>({
    app: "storage",
    path: "/configuration",
  });

  const credentials = await scry<{ "storage-update": { credentials: StorageCredentials } }>({
    app: "storage",
    path: "/credentials",
  });

  const storageConfig = config["storage-update"].configuration;
  const storageCreds = credentials["storage-update"].credentials;

  const isHosted = getConfig().url.includes("tlon.network");
  const useMemex =
    isHosted &&
    (storageConfig.service === "presigned-url" ||
      !storageCreds.accessKeyId ||
      !storageCreds.endpoint ||
      !storageCreds.secretAccessKey);

  if (useMemex) {
    const { hostedUrl, uploadUrl } = await getMemexUploadUrl({
      contentLength: blob.size,
      contentType,
      fileName: fileKey,
    });

    const uploadResp = await fetch(uploadUrl, {
      method: "PUT",
      body: blob,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": contentType,
      },
    });

    if (!uploadResp.ok) {
      throw new Error(`Upload failed: ${uploadResp.status}`);
    }

    return hostedUrl;
  }

  // Self-hosted with custom S3: use presigned URL from storage agent
  if (storageConfig.presignedUrl) {
    const uploadResp = await fetch(storageConfig.presignedUrl, {
      method: "PUT",
      body: blob,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });

    if (!uploadResp.ok) {
      throw new Error(`Upload failed: ${uploadResp.status}`);
    }

    return storageConfig.presignedUrl.split("?")[0];
  }

  throw new Error(
    "No upload method available. Ship must be hosted on tlon.network or have S3 storage configured."
  );
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

  getConfig(); // validate config exists

  const uploadedUrl = await uploadImageFromUrl(url);
  console.log(uploadedUrl);
}

main().catch((err) => {
  console.error(`error: ${err.message || err}`);
  process.exit(1);
});
