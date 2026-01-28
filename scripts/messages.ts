#!/usr/bin/env npx ts-node
/**
 * Messages API for Tlon
 * 
 * Usage:
 *   npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N]
 *   npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N]
 *   npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N]
 *   npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-slug
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

function extractBlocks(blocks: any): string {
  // Handle both single block and array of blocks
  const blockArray = Array.isArray(blocks) ? blocks : [blocks];
  
  return blockArray.map((block: any) => {
    if (!block || typeof block !== 'object') return '';
    if (block.quote) return `> ${extractText(block.quote)}`;
    if (block.code) return `\`\`\`${block.code.lang || ''}\n${block.code.code}\n\`\`\``;
    if (block.header) return `## ${block.header.tag} ${extractText(block.header.content)}`;
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

// Fetch messages from a channel
async function fetchMessages(channel: string, limit: number = 20): Promise<void> {
  getConfig(); // Validate config
  
  console.log(`Fetching messages from: ${channel}`);
  console.log(`Limit: ${limit}\n`);
  
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
      const text = extractText(essay?.content || []);
      const replyRef = seal?.meta?.replyCount ? ` (${seal.meta.replyCount} replies)` : '';
      
      console.log(`[${author}] ${time}${replyRef}`);
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
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--channel' && args[i + 1]) {
      channel = args[i + 1];
      i++;
    }
  }
  
  switch (command) {
    case 'dm': {
      const ship = args[1];
      if (!ship) {
        console.log('Usage: npx ts-node scripts/messages.ts dm ~ship [--limit N]');
        process.exit(1);
      }
      const dmChannel = getDmChannelId(ship);
      await fetchMessages(dmChannel, limit);
      break;
    }
    
    case 'channel': {
      const channelPath = args[1];
      if (!channelPath) {
        console.log('Usage: npx ts-node scripts/messages.ts channel chat/~host/slug [--limit N]');
        process.exit(1);
      }
      await fetchMessages(channelPath, limit);
      break;
    }
    
    case 'history': {
      const channelPath = args[1] || channel;
      if (!channelPath) {
        console.log('Usage: npx ts-node scripts/messages.ts history "chat/~host/slug" [--limit N]');
        process.exit(1);
      }
      await fetchMessages(channelPath, limit);
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
      console.log('  npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N]');
      console.log('  npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N]');
      console.log('  npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N]');
      console.log('  npx ts-node scripts/messages.ts search "query" --channel chat/~host/slug');
      process.exit(1);
  }
}

main().catch(console.error);
