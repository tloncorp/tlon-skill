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

import { scry, getConfig } from './urbit-client';

interface MessageKey {
  id: string;
  time: string;
}

interface Story {
  inline: any[];
  block?: any[];
}

interface ActivityEvent {
  notified: boolean;
  // Post in a channel
  post?: {
    key: MessageKey;
    group: string;
    channel: string;
    content: Story;
    mention: boolean;
  };
  // Reply to a post
  reply?: {
    parent: MessageKey;
    key: MessageKey;
    group: string;
    channel: string;
    content: Story;
    mention: boolean;
  };
  // DM post
  'dm-post'?: {
    key: MessageKey;
    whom: { ship: string } | { club: string };
    content: Story;
    mention: boolean;
  };
  // DM reply
  'dm-reply'?: {
    parent: MessageKey;
    key: MessageKey;
    whom: { ship: string } | { club: string };
    content: Story;
    mention: boolean;
  };
  // Group events
  'group-ask'?: { ship: string; group: string };
  'group-join'?: { ship: string; group: string };
  'group-invite'?: { ship: string; group: string };
  // Contact updates
  contact?: { who: string; update: any };
}

interface ActivityBundle {
  source: any;
  latest: string;
  events: { event: ActivityEvent; time: string }[];
  'source-key': string;
}

interface ActivitySummary {
  recency: number;
  count: number;
  'notify-count': number;
  notify: boolean;
  unread: { id: string; time: string; count: number; notify: boolean } | null;
}

interface InitActivityFeeds {
  all: ActivityBundle[];
  mentions: ActivityBundle[];
  replies: ActivityBundle[];
  summaries: Record<string, ActivitySummary>;
}

// Extract text content from a Story (which is actually an array of blocks)
function extractText(content: any): string {
  if (!content) return '';
  
  // Content is an array of blocks, each block has an 'inline' array
  if (Array.isArray(content)) {
    return content.map((block: any) => {
      if (block.inline) {
        return extractInlines(block.inline);
      }
      return '';
    }).join('');
  }
  
  // Handle legacy Story format
  if (content.inline) {
    return extractInlines(content.inline);
  }
  
  return '';
}

function extractInlines(inlines: any[]): string {
  return inlines.map((inline: any) => {
    if (typeof inline === 'string') return inline;
    if (inline.break) return '\n';
    if (inline.ship) return inline.ship;
    if (inline.bold) return extractInlines(inline.bold);
    if (inline.italics) return extractInlines(inline.italics);
    if (inline.strike) return extractInlines(inline.strike);
    if (inline.blockquote) return extractInlines(inline.blockquote);
    if (inline.link) return inline.link.content || inline.link.href;
    if (inline['inline-code']) return inline['inline-code'];
    if (inline.code) return inline.code;
    return '';
  }).join('');
}

// Get author from message key
function getAuthor(key: MessageKey): string {
  return key.id.split('/')[0];
}

// Format a timestamp (da to readable)
function formatTime(timeStr: string): string {
  // timeStr is a @da like "170.141.184.507.789..." (dots as digit grouping)
  try {
    const daNum = BigInt(timeStr.replace(/\./g, ''));
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

// Format whom (DM target)
function formatWhom(whom: { ship: string } | { club: string }): string {
  if ('ship' in whom) return whom.ship;
  return `club:${whom.club}`;
}

// Format an activity event for display
function formatEvent(event: ActivityEvent, time: string): string {
  const lines: string[] = [];
  const timeStr = formatTime(time);
  
  if (event.post) {
    const author = getAuthor(event.post.key);
    const text = extractText(event.post.content);
    const mention = event.post.mention ? ' [MENTION]' : '';
    lines.push(`📝 Post${mention} by ${author} in ${event.post.channel}`);
    lines.push(`   Group: ${event.post.group}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  }
  
  if (event.reply) {
    const author = getAuthor(event.reply.key);
    const text = extractText(event.reply.content);
    const mention = event.reply.mention ? ' [MENTION]' : '';
    lines.push(`💬 Reply${mention} by ${author} in ${event.reply.channel}`);
    lines.push(`   Group: ${event.reply.group}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  }
  
  if (event['dm-post']) {
    const dm = event['dm-post'];
    const author = getAuthor(dm.key);
    const text = extractText(dm.content);
    const mention = dm.mention ? ' [MENTION]' : '';
    lines.push(`📨 DM${mention} from ${author}`);
    lines.push(`   To: ${formatWhom(dm.whom)}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  }
  
  if (event['dm-reply']) {
    const dm = event['dm-reply'];
    const author = getAuthor(dm.key);
    const text = extractText(dm.content);
    const mention = dm.mention ? ' [MENTION]' : '';
    lines.push(`💬 DM Reply${mention} from ${author}`);
    lines.push(`   To: ${formatWhom(dm.whom)}`);
    lines.push(`   Time: ${timeStr}`);
    lines.push(`   Content: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  }
  
  if (event['group-ask']) {
    lines.push(`🙋 Join request from ${event['group-ask'].ship}`);
    lines.push(`   Group: ${event['group-ask'].group}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  if (event['group-join']) {
    lines.push(`👋 ${event['group-join'].ship} joined`);
    lines.push(`   Group: ${event['group-join'].group}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  if (event['group-invite']) {
    lines.push(`📩 Invite from ${event['group-invite'].ship}`);
    lines.push(`   Group: ${event['group-invite'].group}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  if (event.contact) {
    lines.push(`👤 Contact update from ${event.contact.who}`);
    lines.push(`   Time: ${timeStr}`);
  }
  
  return lines.join('\n');
}

async function getActivity(bucket: 'all' | 'mentions' | 'replies', limit: number = 10) {
  // Initialize config (validates env vars)
  getConfig();
  
  // Use init endpoint to get all buckets at once
  const response = await scry<InitActivityFeeds>({
    app: 'activity',
    path: `/v5/feed/init/${limit}`,
  });
  
  const feed = response[bucket];
  
  if (!feed || feed.length === 0) {
    console.log(`No ${bucket} activity found.`);
    return;
  }
  
  console.log(`\n=== ${bucket.toUpperCase()} (${feed.length} bundles) ===\n`);
  
  for (const bundle of feed) {
    console.log(`Source: ${bundle['source-key']}`);
    console.log('---');
    
    for (const { event, time } of bundle.events) {
      const formatted = formatEvent(event, time);
      if (formatted) {
        console.log(formatted);
        console.log('');
      }
    }
    console.log('');
  }
}

async function getUnreads() {
  // Initialize config (validates env vars)
  getConfig();
  
  const activity = await scry<Record<string, ActivitySummary>>({
    app: 'activity',
    path: '/v4/activity',
  });
  
  console.log('\n=== UNREADS ===\n');
  
  const entries = Object.entries(activity)
    .filter(([_, summary]) => summary.count > 0 || summary.notify)
    .sort((a, b) => b[1].recency - a[1].recency);
  
  if (entries.length === 0) {
    console.log('No unreads!');
    return;
  }
  
  for (const [sourceId, summary] of entries) {
    const notify = summary.notify ? '🔔' : '';
    console.log(`${notify} ${sourceId}`);
    console.log(`   Count: ${summary.count}, Notify count: ${summary['notify-count']}`);
    if (summary.unread) {
      console.log(`   First unread: ${summary.unread.time}`);
    }
    console.log('');
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse --limit flag
  let limit = 10;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }
  
  switch (command) {
    case 'mentions':
      await getActivity('mentions', limit);
      break;
    case 'replies':
      await getActivity('replies', limit);
      break;
    case 'all':
      await getActivity('all', limit);
      break;
    case 'unreads':
      await getUnreads();
      break;
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/activity.ts mentions [--limit N]');
      console.log('  npx ts-node scripts/activity.ts replies [--limit N]');
      console.log('  npx ts-node scripts/activity.ts all [--limit N]');
      console.log('  npx ts-node scripts/activity.ts unreads');
      process.exit(1);
  }
}

main().catch(console.error);
