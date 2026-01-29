#!/usr/bin/env node
/**
 * Channel Summarizer
 * Summarize recent activity in any Tlon channel with privacy controls.
 * Only authorized users can summarize private/secret channels.
 */

import { config } from 'dotenv';
import { Urbit } from '@urbit/http-api';
import { getUrbitCredentials, authToApi } from '../lib/auth.js';

config();

// Configuration
const AUTHORIZED_SHIPS = process.env.SUMMARIZER_AUTH_SHIPS?.split(',') || ['~malmur-halmex'];

interface Message {
  id: string;
  author: string;
  content: string;
  sent: string;
}

interface GroupData {
  secret?: boolean;
  cordon?: {
    shut?: unknown;
    af?: unknown;
  };
  channels?: Record<string, unknown>;
}

function normalizeShip(ship: string): string {
  return ship.startsWith('~') ? ship : `~${ship}`;
}

async function fetchChannelHistory(api: Urbit, channelNest: string, count = 50): Promise<Message[]> {
  const scryPath = `/channels/v4/${channelNest}/posts/newest/${count}/outline.json`;
  const data = await api.scry({ app: 'channels', path: scryPath });
  
  if (!data) return [];
  
  let posts: any[] = [];
  if (Array.isArray(data)) {
    posts = data;
  } else if (data.posts && typeof data.posts === 'object') {
    posts = Object.values(data.posts);
  } else if (typeof data === 'object') {
    posts = Object.values(data);
  }

  return posts.map((item) => {
    const essay = item.essay || item['r-post']?.set?.essay;
    const seal = item.seal || item['r-post']?.set?.seal;
    
    return {
      id: seal?.id || '',
      author: essay?.author || 'unknown',
      content: extractMessageText(essay?.content || []),
      sent: essay?.sent ? new Date(essay.sent).toISOString() : new Date().toISOString(),
    };
  }).filter((msg) => msg.content);
}

function extractMessageText(content: any[]): string {
  if (!Array.isArray(content)) return '';
  
  const parts: string[] = [];
  for (const block of content) {
    if (block.inline) {
      for (const inline of block.inline) {
        if (typeof inline === 'string') {
          parts.push(inline);
        } else if (inline?.text) {
          parts.push(inline.text);
        } else if (inline?.ship) {
          parts.push(inline.ship);
        }
      }
    }
  }
  return parts.join('').trim();
}

async function fetchGroupData(api: Urbit): Promise<Record<string, GroupData>> {
  return await api.scry({ app: 'groups', path: '/groups/groups.json' }) || {};
}

function findChannelGroup(groups: Record<string, GroupData>, channelNest: string) {
  for (const [groupId, groupData] of Object.entries(groups)) {
    if (!groupData?.channels) continue;
    
    if (groupData.channels[channelNest]) {
      return { groupId, groupData, channelData: groupData.channels[channelNest] };
    }
  }
  return null;
}

function getChannelPrivacy(groupData: GroupData | null): 'public' | 'private' | 'secret' | 'unknown' {
  if (!groupData) return 'unknown';
  
  if (groupData.secret === true) return 'secret';
  
  const cordon = groupData.cordon;
  if (cordon?.shut || cordon?.af) return 'private';
  
  return 'public';
}

function checkAuthorization(
  requester: string,
  privacy: string,
  authorizedShips: string[]
): { allowed: boolean; reason: string; message?: string } {
  const normalizedRequester = normalizeShip(requester);
  const normalizedAuthorized = authorizedShips.map(normalizeShip);
  
  if (privacy === 'public') {
    return { allowed: true, reason: 'public_channel' };
  }
  
  if (normalizedAuthorized.includes(normalizedRequester)) {
    return { allowed: true, reason: 'authorized_user' };
  }
  
  return {
    allowed: false,
    reason: 'unauthorized',
    message: `This ${privacy} channel can only be summarized by: ${authorizedShips.join(', ')}`
  };
}

function generateSummary(channel: string, messages: Message[], groupInfo: any): string {
  if (!messages.length) {
    return `📋 Channel Summary: ${channel}\n\nNo messages found.`;
  }
  
  const uniqueAuthors = [...new Set(messages.map(m => m.author))];
  const oldestMsg = messages[messages.length - 1];
  const newestMsg = messages[0];
  
  // Extract topics
  const allContent = messages.map(m => m.content.toLowerCase()).join(' ');
  const topics: string[] = [];
  
  const topicKeywords = [
    ['prometheus', 'metrics', 'monitoring'],
    ['bot', 'clawdbot', 'agent', 'skill'],
    ['hosting', 'vm', 'server', 'infrastructure'],
    ['deploy', 'release', 'ship'],
    ['bug', 'fix', 'issue', 'error'],
    ['feature', 'implement'],
    ['pricing', 'cost'],
    ['security', 'access', 'auth']
  ];
  
  for (const keywords of topicKeywords) {
    if (keywords.some(k => allContent.includes(k))) {
      topics.push(keywords[0]);
    }
  }
  
  let summary = `📋 Channel Summary: ${channel}\n`;
  
  if (groupInfo) {
    summary += `**Group:** ${groupInfo.groupId}\n`;
    summary += `**Privacy:** ${groupInfo.privacy}\n`;
  }
  
  summary += `\n**Period:** Last ${messages.length} messages\n`;
  summary += `**Date Range:** ${new Date(oldestMsg.sent).toLocaleDateString()} to ${new Date(newestMsg.sent).toLocaleDateString()}\n`;
  
  if (topics.length) {
    summary += `\n**Key Topics:**\n${topics.map(t => `- ${t.charAt(0).toUpperCase() + t.slice(1)}`).join('\n')}\n`;
  }
  
  // Find potential decisions
  const decisionWords = ['agreed', 'decided', 'conclusion', 'lets', "let's", 'we should'];
  const decisions = messages
    .filter(m => decisionWords.some(d => m.content.toLowerCase().includes(d)))
    .map(m => `- ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`);
  
  if (decisions.length) {
    summary += `\n**Decisions:**\n${decisions.slice(0, 3).join('\n')}\n`;
  }
  
  summary += `\n**Active Participants:** ${uniqueAuthors.join(', ')}\n`;
  
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const channelIndex = args.indexOf('--channel');
  const countIndex = args.indexOf('--count');
  const requesterIndex = args.indexOf('--requester');
  
  const channel = channelIndex >= 0 ? args[channelIndex + 1] : null;
  const count = countIndex >= 0 ? parseInt(args[countIndex + 1], 10) || 50 : 50;
  const requester = requesterIndex >= 0 ? args[requesterIndex + 1] : process.env.URBIT_SHIP;
  
  if (!channel) {
    console.error('❌ Error: --channel is required');
    console.error('Usage: npx ts-node scripts/summarize.ts --channel chat/~host/channel [--count 50] [--requester ~ship]');
    process.exit(1);
  }
  
  if (!requester) {
    console.error('❌ Error: --requester required or set URBIT_SHIP env var');
    process.exit(1);
  }
  
  console.error(`🔍 Summarizing: ${channel}`);
  console.error(`👤 Requester: ${requester}`);
  
  const creds = getUrbitCredentials();
  const api = await authToApi(creds);
  
  // Check permissions
  const groups = await fetchGroupData(api);
  const channelInfo = findChannelGroup(groups, channel);
  const privacy = getChannelPrivacy(channelInfo?.groupData || null);
  
  console.error(`🔒 Channel privacy: ${privacy}`);
  
  const authCheck = checkAuthorization(requester, privacy, AUTHORIZED_SHIPS);
  
  if (!authCheck.allowed) {
    console.error(`❌ Access denied: ${authCheck.message}`);
    process.exit(1);
  }
  
  console.error(`✅ Access granted: ${authCheck.reason}`);
  
  // Fetch and summarize
  const messages = await fetchChannelHistory(api, channel, count);
  console.error(`📝 Fetched ${messages.length} messages`);
  
  const groupInfo = channelInfo ? {
    groupId: channelInfo.groupId,
    privacy
  } : null;
  
  const summary = generateSummary(channel, messages, groupInfo);
  console.log(summary);
  
  await api.delete();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
