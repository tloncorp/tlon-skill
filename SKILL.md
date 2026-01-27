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

### Groups

**List your groups:**
```bash
npx ts-node scripts/groups.ts list
```

**Create a new group:**
```bash
npx ts-node scripts/groups.ts create "Group Name" [--description "..."]
```

**Get group info:**
```bash
npx ts-node scripts/groups.ts info ~ship/group-slug
```

**Invite members:**
```bash
npx ts-node scripts/groups.ts invite ~ship/group-slug ~invitee1 ~invitee2
```

**Leave a group:**
```bash
npx ts-node scripts/groups.ts leave ~ship/group-slug
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

### Notebooks (Diary Channels)

**Post to a notebook:**
```bash
npx ts-node scripts/notebook-post.ts diary/~host/channel-name "Post Title"
```

**Post with a cover image:**
```bash
npx ts-node scripts/notebook-post.ts diary/~host/channel-name "Post Title" --image https://example.com/cover.png
```

**Post with rich content from a JSON file:**
```bash
npx ts-node scripts/notebook-post.ts diary/~host/channel-name "Post Title" --content article.json
```

**Post with content from stdin:**
```bash
echo '[{"inline":["Hello, world!"]}]' | npx ts-node scripts/notebook-post.ts diary/~host/channel-name "Post Title" --stdin
```

Content format is Tlon's Story structure - an array of verses:
```json
[
  { "inline": ["Plain text or ", { "bold": ["bold"] }, " text"] },
  { "block": { "header": { "tag": "h2", "content": ["Section Title"] } } },
  { "block": { "code": { "code": "const x = 1;", "lang": "javascript" } } },
  { "inline": [{ "blockquote": ["A wise quote"] }] }
]
```

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## Notes

- All ship names should include the `~` prefix
- Profile updates sync to peers automatically via the contacts agent
- This skill is read-heavy; for sending messages, use the `message` tool with `channel=tlon`
