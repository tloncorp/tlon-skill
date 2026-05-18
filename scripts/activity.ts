#!/usr/bin/env npx ts-node
/**
 * Activity/Notifications API for Tlon
 * 
 * Usage:
 *   npx ts-node scripts/activity.ts mentions [--limit N]
 *   npx ts-node scripts/activity.ts replies [--limit N]
 *   npx ts-node scripts/activity.ts all [--limit N]
 *   npx ts-node scripts/activity.ts unreads
 */

import { getInitialActivity, getGroupAndChannelUnreads, getTextContent } from "@tloncorp/api";
import { ensureClient } from "./api-client";
import { isHelpArg, printErrorAndExit, printHelpAndExit, printUsageAndExit } from "./cli-utils";

interface ActivityEvent {
  id: string;
  bucketId: "all" | "mentions" | "replies";
  sourceId: string;
  type: string;
  timestamp: number;
  postId?: string | null;
  authorId?: string | null;
  parentId?: string | null;
  parentAuthorId?: string | null;
  channelId?: string | null;
  groupId?: string | null;
  isMention?: boolean | null;
  shouldNotify?: boolean | null;
  content?: any | null;
  groupEventUserId?: string | null;
  contactUserId?: string | null;
  contactUpdateType?: string | null;
  contactUpdateValue?: string | null;
}

const ACTIVITY_HELP = `Usage: tlon activity <command>

Commands:
  mentions [--limit N]   Show mention activity
  replies [--limit N]    Show reply activity
  all [--limit N]        Show all activity
  unreads                Show unread counts`;

// Extract text content from a Story (which is actually an array of blocks)
function extractText(content: any): string {
  if (!content) return "";
  const text = getTextContent(content);
  return text || "";
}

// Format a timestamp (da to readable)
function formatTime(timeStr: string | number): string {
  // timeStr is a @da like "170.141.184.507.789..." (dots as digit grouping)
  try {
    const str = String(timeStr);
    const daNum = BigInt(str.replace(/\./g, ""));
    // Constants from @urbit/aura
    const DA_SECOND = BigInt('18446744073709551616'); // 2^64, represents 1 second in da
    const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000'); // ~1970.1.1
    
    // Port of toUnix from @urbit/aura
    const offset = DA_SECOND / BigInt(2000);
    const epochAdjusted = offset + (daNum - DA_UNIX_EPOCH);
    const unixMs = Math.round(Number(epochAdjusted * BigInt(1000) / DA_SECOND));
    
    const date = new Date(unixMs);
    // Check if date is reasonable (after 2020, before 2100)
    if (date.getFullYear() > 2020 && date.getFullYear() < 2100) {
      return date.toLocaleString();
    }
    return 'unknown date';
  } catch {
    return 'unknown';
  }
}

// Format an activity event for display
function formatEvent(event: ActivityEvent): string {
  const lines: string[] = [];
  const timeStr = formatTime(event.timestamp);
  
  if (event.type === "post") {
    const author = event.authorId || "unknown";
    const text = extractText(event.content);
    const mention = event.isMention ? " [MENTION]" : "";
    lines.push(`📝 Post${mention} by ${author} in ${event.channelId}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
  }
  
  if (event.type === "reply") {
    const author = event.authorId || "unknown";
    const text = extractText(event.content);
    const mention = event.isMention ? " [MENTION]" : "";
    lines.push(`💬 Reply${mention} by ${author} in ${event.channelId}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
  }
  
  if (event.type === "dm-post") {
    const author = event.authorId || "unknown";
    const text = extractText(event.content);
    const mention = event.isMention ? " [MENTION]" : "";
    lines.push(`📨 DM${mention} from ${author}`);
    if (event.channelId) lines.push(`   To: ${event.channelId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
  }
  
  if (event.type === "dm-reply") {
    const author = event.authorId || "unknown";
    const text = extractText(event.content);
    const mention = event.isMention ? " [MENTION]" : "";
    lines.push(`💬 DM Reply${mention} from ${author}`);
    if (event.channelId) lines.push(`   To: ${event.channelId}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
  }
  
  if (event.type === "group-ask") {
    lines.push(`🙋 Join request from ${event.groupEventUserId || "unknown"}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  if (event.type === "group-join") {
    lines.push(`👋 ${event.groupEventUserId || "unknown"} joined`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  if (event.type === "group-invite") {
    lines.push(`📩 Invite from ${event.groupEventUserId || "unknown"}`);
    if (event.groupId) lines.push(`   Group: ${event.groupId}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  if (event.type === "contact") {
    lines.push(`👤 Contact update from ${event.contactUserId || "unknown"}`);
    if (event.contactUpdateType) {
      lines.push(`   Update: ${event.contactUpdateType}`);
    }
    lines.push(`   Time: ${timeStr}`);
  }

  return lines.join('\n');
}

async function getActivity(bucket: 'all' | 'mentions' | 'replies', limit: number = 10) {

  const { events } = await getInitialActivity();
  const bucketEvents = events
    .filter((event) => event.bucketId === bucket)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  if (bucketEvents.length === 0) {
    console.log(`No ${bucket} activity found.`);
    return;
  }
  
  console.log(`\n=== ${bucket.toUpperCase()} (${bucketEvents.length} events) ===\n`);

  for (const event of bucketEvents) {
    const formatted = formatEvent(event as ActivityEvent);
    if (formatted) {
      console.log(formatted);
      console.log("");
    }
  }
}

async function getUnreads() {

  const activity = await getGroupAndChannelUnreads();

  console.log('\n=== UNREADS ===\n');

  const groupEntries = activity.groupUnreads.filter(
    (summary) => (summary.count || 0) > 0 || summary.notify
  );
  const channelEntries = activity.channelUnreads.filter(
    (summary) => (summary.count || 0) > 0 || summary.notify
  );

  if (groupEntries.length === 0 && channelEntries.length === 0) {
    console.log('No unreads!');
    return;
  }

  if (activity.baseUnread) {
    const base = activity.baseUnread;
    const notify = base.notify ? "🔔" : "";
    console.log(`${notify} base`);
    console.log(`   Count: ${base.count ?? 0}, Notify count: ${base.notifyCount ?? 0}`);
    console.log("");
  }

  for (const summary of groupEntries) {
    const notify = summary.notify ? "🔔" : "";
    console.log(`${notify} group/${summary.groupId}`);
    console.log(`   Count: ${summary.count ?? 0}, Notify count: ${summary.notifyCount ?? 0}`);
    console.log("");
  }

  for (const summary of channelEntries) {
    const notify = summary.notify ? "🔔" : "";
    console.log(`${notify} channel/${summary.channelId}`);
    console.log(`   Count: ${summary.count ?? 0}, Notify count: ${summary.countWithoutThreads ?? 0}`);
    if (summary.firstUnreadPostId) {
      console.log(`   First unread: ${summary.firstUnreadPostId}`);
    }
    console.log("");
  }
}

const ACTIVITY_HANDLERS = {
  mentions: (limit: number) => getActivity("mentions", limit),
  replies: (limit: number) => getActivity("replies", limit),
  all: (limit: number) => getActivity("all", limit),
  unreads: (_limit: number) => getUnreads(),
} satisfies Record<string, (limit: number) => Promise<void>>;

type ActivityCommand = keyof typeof ACTIVITY_HANDLERS;

function isActivityCommand(command: string): command is ActivityCommand {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_HANDLERS, command);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(ACTIVITY_HELP);
  }

  if (!command) {
    printUsageAndExit(ACTIVITY_HELP);
  }

  if (!isActivityCommand(command)) {
    printUsageAndExit(ACTIVITY_HELP);
  }

  await ensureClient();
  
  // Parse --limit flag
  let limit = 10;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }
  
  await ACTIVITY_HANDLERS[command](limit);
  process.exit(0);
}

main().catch(printErrorAndExit);
