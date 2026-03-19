/**
 * Upload a file to Tlon storage
 *
 * Usage:
 *   tlon upload <url-or-path>           # Upload from URL or local file
 *   tlon upload --stdin [-t mime/type]   # Upload from stdin (piped binary)
 *   tlon upload <path> [-t mime/type]    # Override content type
 *
 * Examples:
 *   tlon upload https://example.com/image.png
 *   tlon upload ./photo.jpg
 *   tlon upload ~/Pictures/screenshot.png
 *   cat image.png | tlon upload --stdin -t image/png
 *   tlon upload ./doc.pdf -t application/pdf
 */

import * as fs from "fs";
import * as path from "path";
import { uploadFile } from "@tloncorp/api";
import { ensureClient } from "./api-client";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** Common extension → MIME type mappings (no external dependency needed) */
const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
};

/** Guess MIME type from file extension */
function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || DEFAULT_CONTENT_TYPE;
}

/** Check if input looks like a URL */
function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

/** Read all of stdin into a Buffer */
async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Upload a Blob and return the resulting URL */
async function doUpload(blob: Blob, contentType: string, fileName?: string): Promise<string> {
  const result = await uploadFile({
    blob,
    contentType,
    fileName,
  });
  return result.url;
}

/** Upload from a remote URL */
export async function uploadFromUrl(imageUrl: string, contentType?: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const ct = contentType || blob.type || mimeFromPath(imageUrl) || DEFAULT_CONTENT_TYPE;
  const fileName = path.basename(new URL(imageUrl).pathname) || undefined;
  return doUpload(blob, ct, fileName);
}

/** Upload from a local file path */
export async function uploadFromFile(filePath: string, contentType?: string): Promise<string> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const buffer = fs.readFileSync(resolved);
  const ct = contentType || mimeFromPath(resolved);
  const blob = new Blob([buffer], { type: ct });
  const fileName = path.basename(resolved);
  return doUpload(blob, ct, fileName);
}

/** Upload from stdin binary data */
export async function uploadFromStdin(contentType: string): Promise<string> {
  const buffer = await readStdin();
  if (buffer.length === 0) {
    throw new Error("No data received on stdin");
  }
  const blob = new Blob([buffer], { type: contentType });
  return doUpload(blob, contentType);
}

export async function main(args: string[]) {
  // Parse flags
  let stdinMode = false;
  let contentType: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--stdin") {
      stdinMode = true;
    } else if ((arg === "-t" || arg === "--type") && args[i + 1]) {
      contentType = args[i + 1];
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }

  if (!stdinMode && positional.length === 0) {
    printHelp();
    process.exit(1);
  }

  await ensureClient();

  let uploadedUrl: string;

  if (stdinMode) {
    const ct = contentType || DEFAULT_CONTENT_TYPE;
    uploadedUrl = await uploadFromStdin(ct);
  } else {
    const input = positional[0];
    if (isUrl(input)) {
      uploadedUrl = await uploadFromUrl(input, contentType);
    } else {
      uploadedUrl = await uploadFromFile(input, contentType);
    }
  }

  console.log(uploadedUrl);
  process.exit(0);
}

function printHelp() {
  console.log(`Usage: upload <url-or-path> [options]
       upload --stdin [-t mime/type]

Upload a file to Tlon storage from a URL, local path, or stdin.
Outputs the uploaded URL on success.

Options:
  --stdin         Read binary data from stdin instead of a file/URL
  -t, --type      Override content type (e.g., image/png, application/pdf)
  -h, --help      Show this help

Examples:
  tlon upload https://example.com/image.png
  tlon upload ./photo.jpg
  tlon upload ~/Pictures/screenshot.png
  tlon upload ./mystery-file -t image/webp
  cat image.png | tlon upload --stdin -t image/png
  curl -s https://example.com/img.jpg | tlon upload --stdin -t image/jpeg`);
}
