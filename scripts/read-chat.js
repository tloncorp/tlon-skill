#!/usr/bin/env node

// Simple script to read chat messages - no TS compilation issues
const url = process.env.URBIT_URL;
const ship = process.env.URBIT_SHIP;
const code = process.env.URBIT_CODE;

if (!url || !ship || !code) {
  console.error('Missing Urbit config. Set URBIT_URL, URBIT_SHIP, and URBIT_CODE environment variables.');
  process.exit(1);
}

async function login() {
  const resp = await fetch(`${url}/~/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `password=${code}`,
  });

  if (!resp.ok) {
    throw new Error(`Login failed with status ${resp.status}`);
  }

  const cookie = resp.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('No auth cookie received');
  }

  return cookie.split(';')[0];
}

async function scry(path) {
  const cookie = await login();
  
  const resp = await fetch(`${url}/~/scry/${path}.json`, {
    method: 'GET',
    headers: { Cookie: cookie },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Scry failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

async function main() {
  const channelId = process.argv[2]; // 'chat/~datler-rovder/v1vnak1d'
  
  if (!channelId) {
    console.error('Usage: node read-chat.js <channel-id>');
    process.exit(1);
  }

  try {
    const messages = await scry(`/v1/message/${channelId}.json`);
    
    console.log('Total messages:', Object.keys(messages).length);
    console.log('Last 10 messages:');
    console.log(JSON.stringify(messages.slice(-10).reverse(), null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
