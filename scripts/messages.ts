#!/usr/bin/env npx ts-node
/**
 * Messages API for Tlon
 * 
 * Usage:
 *   npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-slug
 * 
 * Options:
 *   --resolve-cites, --quotes   Fetch and display quoted/cited message content
 */

import { scry, getConfig, normalizeShip } from './urbit-client';

interface MessageKey {
  id: string;
  time: string;
}

interface Story {
  inline?: any[];
  block?: any[];
}

interface Message {
  key: MessageKey;
  author: string;
  content: Story;
  replied?: MessageKey;
  repliedBy?: string;
}

interface ChatInfo {
  id: string;
  nick?: string;
  dial?: string;
  enactor: string;
  createdAt: string;
}

interface ChatMessages {
  messages: Message[];
}

// Extract text content from a Story
function extractText(content: any): string {
  if (!content) return '';
  
  // Content is an array of blocks
  if (Array.isArray(content)) {
    return content.map((block: any) => {
      if (block.inline) {
        return extractInlines(block.inline);
      }
      if (block.block) {
        return extractBlocks(block.block);
      }
      return '';
    }).join('');
  }
  
  // Handle legacy format
  if (content.inline) {
    return extractInlines(content.inline);
  }
  
  return '';
}

function extractInlines(inlines: any[]): string {
  return inlines.map((inline: any) => {
    if (typeof inline === 'string') return inline;
    if (!inline || typeof inline !== 'object') return '';
    if (inline.break) return '\n';
    if (inline.ship) return inline.ship;
    if (inline.bold) return `**${extractInlines(inline.bold)}**`;
    if (inline.italics) return `*${extractInlines(inline.italics)}*`;
    if (inline.strike) return `~~${extractInlines(inline.strike)}~~`;
    if (inline.blockquote) return `> ${extractInlines(inline.blockquote)}`;
    if (inline.link) return `[${inline.link.content || inline.link.href}](${inline.link.href})`;
    if (inline['inline-code']) return `\`${inline['inline-code']}\``;
    if (inline.code) return `\`\`\`\n${inline.code}\n\`\`\``;
    return '';
  }).join('');
}

// Cite types
interface ParsedCite {
  type: "chan" | "group" | "desk" | "bait";
  nest?: string;
  author?: string;
  postId?: string;
  group?: string;
  where?: string;
}

// Extract cite info from a cite block
function parseCite(cite: any): ParsedCite | null {
  if (!cite || typeof cite !== 'object') return null;
  
  if (cite.chan && typeof cite.chan === 'object') {
    const { nest, where } = cite.chan;
    const whereMatch = where?.match(/\/msg\/(~[a-z-]+)\/(.+)/);
    return {
      type: 'chan',
      nest,
      where,
      author: whereMatch?.[1],
      postId: whereMatch?.[2],
    };
  }
  if (cite.group && typeof cite.group === 'string') {
    return { type: 'group', group: cite.group };
  }
  if (cite.desk && typeof cite.desk === 'object') {
    return { type: 'desk', where: cite.desk.where };
  }
  if (cite.bait && typeof cite.bait === 'object') {
    return { type: 'bait', group: cite.bait.group, nest: cite.bait.graph, where: cite.bait.where };
  }
  return null;
}

// Fetch cited message content
async function fetchCiteContent(cite: ParsedCite): Promise<string | null> {
  if (cite.type !== 'chan' || !cite.nest || !cite.postId) return null;
  
  try {
    const scryPath = `/v4/${cite.nest}/posts/post/${cite.postId}`;
    const data = await scry<any>({
      app: 'channels',
      path: scryPath,
    });
    
    if (data?.essay?.content) {
      return extractText(data.essay.content);
    }
    return null;
  } catch {
    return null;
  }
}

function extractBlocks(blocks: any): string {
  // Handle both single block and array of blocks
  const blockArray = Array.isArray(blocks) ? blocks : [blocks];
  
  return blockArray.map((block: any) => {
    if (!block || typeof block !== 'object') return '';
    if (block.quote) return `> ${extractText(block.quote)}`;
    if (block.code) return `\`\`\`${block.code.lang || ''}\n${block.code.code}\n\`\`\``;
    if (block.header) return `## ${block.header.tag} ${extractText(block.header.content)}`;
    if (block.cite) {
      const cite = parseCite(block.cite);
      if (cite?.type === 'chan' && cite.author) {
        return `> [quoted: ${cite.author}]`;
      }
      if (cite?.type === 'group' && cite.group) {
        return `> [ref: group ${cite.group}]`;
      }
      return '> [quoted message]';
    }
    if (block.list) {
      const items = Array.isArray(block.list) ? block.list : [block.list];
      return items.map((item: any, i: number) => {
        const prefix = block.list.type === 'ordered' ? `${i + 1}.` : '-';
        return `${prefix} ${extractText(item)}`;
      }).join('\n');
    }
    return '';
  }).join('\n');
}

// Format a timestamp
function formatTime(timeVal: string | number): string {
  try {
    // Check if it's already a Unix timestamp (numeric)
    const num = typeof timeVal === 'number' ? timeVal : parseInt(timeVal, 10);
    if (!isNaN(num) && num > 1600000000000) {
      // Looks like a Unix timestamp in milliseconds
      const date = new Date(num);
      return date.toLocaleString();
    }
    
    // Otherwise try @da parsing
    const timeStr = String(timeVal);
    const daNum = BigInt(timeStr.replace(/\./g, ''));
    const DA_SECOND = BigInt('18446744073709551616');
    const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');
    const offset = DA_SECOND / BigInt(2000);
    const epochAdjusted = offset + (daNum - DA_UNIX_EPOCH);
    const unixMs = Math.round(Number(epochAdjusted * BigInt(1000) / DA_SECOND));
    
    const date = new Date(unixMs);
    if (date.getFullYear() > 2020 && date.getFullYear() < 2100) {
      return date.toLocaleString();
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Get a DM channel ID
function getDmChannelId(ship: string): string {
  const normalizedShip = normalizeShip(ship);
  // DMs are stored as chat/~ship/dm
  return `chat/${normalizedShip.slice(1)}/dm`;
}

// Extract all cites from content for resolution
function extractCites(content: any[]): ParsedCite[] {
  const cites: ParsedCite[] = [];
  if (!Array.isArray(content)) return cites;
  
  for (const block of content) {
    if (block?.block?.cite) {
      const cite = parseCite(block.block.cite);
      if (cite) cites.push(cite);
    }
  }
  return cites;
}

// Fetch messages from a channel
async function fetchMessages(channel: string, limit: number = 20, resolveCites: boolean = false): Promise<void> {
  getConfig(); // Validate config
  
  console.log(`Fetching messages from: ${channel}`);
  console.log(`Limit: ${limit}${resolveCites ? ' (resolving quotes)' : ''}\n`);
  
  try {
    // Use channels v4 API with outline endpoint
    const scryPath = `/v4/${channel}/posts/newest/${limit}/outline`;
    const data = await scry<any>({
      app: 'channels',
      path: scryPath,
    });
    
    if (!data) {
      console.log('No messages found.');
      return;
    }

    // Parse posts from response
    const postsObj = data.posts || {};
    const postIds = Object.keys(postsObj).sort((a, b) => {
      // Sort by sent time (oldest first for reading chronologically)
      const timeA = postsObj[a]?.essay?.sent || 0;
      const timeB = postsObj[b]?.essay?.sent || 0;
      return timeA - timeB;
    });
    
    // Take the most recent posts (end of sorted array)
    const recentIds = postIds.slice(-limit);
    
    if (recentIds.length === 0) {
      console.log('No messages found.');
      return;
    }
    
    console.log(`=== Messages (${recentIds.length}) ===\n`);
    
    for (const id of recentIds) {
      const item = postsObj[id];
      const essay = item.essay;
      const seal = item.seal;
      const author = essay?.author || "unknown";
      const time = essay?.sent ? formatTime(essay.sent) : 'unknown';
      const replyRef = seal?.meta?.replyCount ? ` (${seal.meta.replyCount} replies)` : '';
      
      // Resolve cited content if requested
      let quotedText = '';
      if (resolveCites && essay?.content) {
        const cites = extractCites(essay.content);
        for (const cite of cites) {
          const citedContent = await fetchCiteContent(cite);
          if (citedContent) {
            const citeAuthor = cite.author || 'unknown';
            quotedText += `> ${citeAuthor} wrote: ${citedContent.substring(0, 200)}${citedContent.length > 200 ? '...' : ''}\n`;
          }
        }
      }
      
      const text = extractText(essay?.content || []);
      
      console.log(`[${author}] ${time}${replyRef}`);
      if (quotedText) console.log(quotedText);
      console.log(text.substring(0, 500));
      if (text.length > 500) console.log('...');
      console.log('');
    }
  } catch (error: any) {
    console.log(`Error: ${error.message}`);
    console.log('Note: Check that the channel path is correct (e.g., chat/~host/slug)');
  }
}

// Search messages in a channel
async function searchMessages(query: string, channel: string): Promise<void> {
  getConfig();
  
  console.log(`Searching "${query}" in: ${channel}\n`);
  
  try {
    const results = await scry<any>({
      app: 'chat',
      path: `/v1/chats/${channel}/search/${query}`,
    });
    
    console.log('Search results:', JSON.stringify(results, null, 2));
  } catch (error: any) {
    console.log(`Search failed: ${error.message}`);
    console.log('Note: Search may require a different API endpoint.');
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse flags
  let limit = 20;
  let channel: string | null = null;
  let resolveCites = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--channel' && args[i + 1]) {
      channel = args[i + 1];
      i++;
    }
    if (args[i] === '--resolve-cites' || args[i] === '--quotes') {
      resolveCites = true;
    }
  }
  
  switch (command) {
    case 'dm': {
      const ship = args[1];
      if (!ship) {
        console.log('Usage: npx ts-node scripts/messages.ts dm ~ship [--limit N] [--resolve-cites]');
        process.exit(1);
      }
      const dmChannel = getDmChannelId(ship);
      await fetchMessages(dmChannel, limit, resolveCites);
      break;
    }
    
    case 'channel': {
      const channelPath = args[1];
      if (!channelPath) {
        console.log('Usage: npx ts-node scripts/messages.ts channel chat/~host/slug [--limit N] [--resolve-cites]');
        process.exit(1);
      }
      await fetchMessages(channelPath, limit, resolveCites);
      break;
    }
    
    case 'history': {
      const channelPath = args[1] || channel;
      if (!channelPath) {
        console.log('Usage: npx ts-node scripts/messages.ts history "chat/~host/slug" [--limit N] [--resolve-cites]');
        process.exit(1);
      }
      await fetchMessages(channelPath, limit, resolveCites);
      break;
    }
    
    case 'search': {
      const query = args[1];
      const channelPath = channel || args[2];
      if (!query || !channelPath) {
        console.log('Usage: npx ts-node scripts/messages.ts search "query" --channel chat/~host/slug');
        process.exit(1);
      }
      await searchMessages(query, channelPath);
      break;
    }
    
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N] [--resolve-cites]');
      console.log('  npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N] [--resolve-cites]');
      console.log('  npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N] [--resolve-cites]');
      console.log('  npx ts-node scripts/messages.ts search "query" --channel chat/~host/slug');
      console.log('');
      console.log('Options:');
      console.log('  --limit N         Number of messages to fetch (default: 20)');
      console.log('  --resolve-cites   Fetch and display quoted message content');
      console.log('  --quotes          Alias for --resolve-cites');
      process.exit(1);
  }
}

main().catch(console.error);
