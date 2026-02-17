/**
 * Upload an image from a URL to Tlon storage
 *
 * Usage:
 *   tlon upload <image-url>
 *
 * Examples:
 *   tlon upload https://example.com/image.png
 */

import { uploadFile } from "@tloncorp/api";
import { ensureClient } from "./api-client";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  const blob = await fetchImageBlob(imageUrl);
  const result = await uploadFile({
    blob,
    contentType: blob.type || DEFAULT_CONTENT_TYPE,
  });

  return result.url;
}

export async function main(args: string[]) {
  const url = args[0];

  if (!url || url === "--help" || url === "-h") {
    console.log(`Usage: upload <image-url>

Fetches an image from a URL and uploads it to Tlon storage.
Outputs the uploaded URL on success.

Examples:
  tlon upload https://example.com/image.png
  tlon upload https://httpbin.org/image/png`);
    process.exit(url ? 0 : 1);
  }

  await ensureClient();

  const uploadedUrl = await uploadImageFromUrl(url);
  console.log(uploadedUrl);
  process.exit(0);
}
