---
name: tlon
description: Interact with Tlon/Urbit beyond the channel plugin. Use for contacts (get/update profiles, nicknames, avatars), listing channels/groups, fetching message history, and ship lookups. Complements the Tlon channel - use this skill for read operations and profile management.
---

# Tlon Skill

Provides direct Urbit API access beyond what the Tlon channel plugin offers.

## Setup

Scripts require these environment variables (from gateway config):
- `URBIT_URL` - Ship URL (e.g., `https://myship.tlon.network`)
- `URBIT_SHIP` - Ship name (e.g., `~sampel-palnet`)
- `URBIT_CODE` - Ship access code

The skill reads these from your Tlon channel config automatically.

## Available Scripts

### Contacts

**Get all contacts:**
```bash
npx ts-node scripts/contacts.ts list
```

**Get a specific contact's profile:**
```bash
npx ts-node scripts/contacts.ts get ~sampel-palnet
```

**Update your profile:**
```bash
npx ts-node scripts/contacts.ts update-profile --nickname "My Name" --bio "About me" --status "Available"
```

**Update your avatar:**
```bash
npx ts-node scripts/contacts.ts update-profile --avatar "https://example.com/avatar.png"
```

### Channels

**List DMs:**
```bash
npx ts-node scripts/channels.ts dms
```

**List group DMs:**
```bash
npx ts-node scripts/channels.ts group-dms
```

**List subscribed groups:**
```bash
npx ts-node scripts/channels.ts groups
```

### Activity / Notifications

**Get recent mentions:**
```bash
npx ts-node scripts/activity.ts mentions [--limit N]
```

**Get recent replies:**
```bash
npx ts-node scripts/activity.ts replies [--limit N]
```

**Get all recent activity:**
```bash
npx ts-node scripts/activity.ts all [--limit N]
```

**Get unread counts:**
```bash
npx ts-node scripts/activity.ts unreads
```

### Messages

**Get recent messages from a DM:**
```bash
npx ts-node scripts/messages.ts dm ~sampel-palnet --limit 20
```

**Search messages:**
```bash
npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-name
```

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## Notes

- All ship names should include the `~` prefix
- Profile updates sync to peers automatically via the contacts agent
- This skill is read-heavy; for sending messages, use the `message` tool with `channel=tlon`
