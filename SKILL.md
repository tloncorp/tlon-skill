---
name: tlon
description: Interact with Tlon/Urbit beyond the channel plugin. Use for contacts (get/update profiles, nicknames, avatars), listing channels/groups, fetching message history, posting to channels, sending DMs, and ship lookups. Complements the Tlon channel - use this skill for read operations, profile management, and direct API access.
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

### Posting to Channels

**Send a message to a channel:**
```bash
npx ts-node scripts/posts.ts send chat/~host/channel-name "Hello everyone!"
```

**Reply to a post:**
```bash
npx ts-node scripts/posts.ts reply chat/~host/channel-name <post-id> "Great point!"
```

**React to a post:**
```bash
npx ts-node scripts/posts.ts react chat/~host/channel-name <post-id> 👍
```

**Remove a reaction:**
```bash
npx ts-node scripts/posts.ts unreact chat/~host/channel-name <post-id>
```

**Delete a post:**
```bash
npx ts-node scripts/posts.ts delete chat/~host/channel-name <post-id>
```

### Direct Messages

**Send a DM:**
```bash
npx ts-node scripts/dms.ts send ~sampel-palnet "Hey, how's it going?"
```

**Reply in a DM thread:**
```bash
npx ts-node scripts/dms.ts reply ~sampel-palnet <post-id> "Thanks for the reply!"
```

**React to a DM:**
```bash
npx ts-node scripts/dms.ts react ~sampel-palnet <post-id> ❤️
```

**Remove reaction from a DM:**
```bash
npx ts-node scripts/dms.ts unreact ~sampel-palnet <post-id>
```

**Delete a DM:**
```bash
npx ts-node scripts/dms.ts delete ~sampel-palnet <post-id>
```

**Accept a DM invite:**
```bash
npx ts-node scripts/dms.ts accept ~sampel-palnet
```

**Decline a DM invite:**
```bash
npx ts-node scripts/dms.ts decline ~sampel-palnet
```

**Send to a group DM (club):**
```bash
npx ts-node scripts/dms.ts send 0v4.club-id "Message to the group"
```

### Contacts

**Get all contacts:**
```bash
npx ts-node scripts/contacts.ts list
```

**Get a specific contact's profile:**
```bash
npx ts-node scripts/contacts.ts get ~sampel-palnet
```

**Add a contact:**
```bash
npx ts-node scripts/contacts.ts add ~sampel-palnet
```

**Remove a contact:**
```bash
npx ts-node scripts/contacts.ts remove ~sampel-palnet
```

**Sync (fetch) profiles from ships:**
```bash
npx ts-node scripts/contacts.ts sync ~sampel-palnet ~zod
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

**Get channel info:**
```bash
npx ts-node scripts/channels.ts info chat/~host/channel-name
```

**Update channel metadata:**
```bash
npx ts-node scripts/channels.ts update chat/~host/channel-name --title "New Title" [--description "..."]
```

**Delete a channel (must be group admin):**
```bash
npx ts-node scripts/channels.ts delete chat/~host/channel-name
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

**Join a group:**
```bash
npx ts-node scripts/groups.ts join ~ship/group-slug
```

**Add a channel to a group:**
```bash
npx ts-node scripts/groups.ts add-channel ~ship/group-slug "Channel Name" [--kind chat|diary|heap] [--description "..."]
```

### Group Administration (Host Only)

**Delete a group:**
```bash
npx ts-node scripts/groups.ts delete ~ship/group-slug
```

**Update group metadata:**
```bash
npx ts-node scripts/groups.ts update ~ship/group-slug --title "New Title" [--description "..."] [--image "https://..."]
```

**Kick members:**
```bash
npx ts-node scripts/groups.ts kick ~ship/group-slug ~member1 ~member2
```

**Ban members:**
```bash
npx ts-node scripts/groups.ts ban ~ship/group-slug ~member1 ~member2
```

**Unban members:**
```bash
npx ts-node scripts/groups.ts unban ~ship/group-slug ~member1 ~member2
```

**Set group privacy:**
```bash
npx ts-node scripts/groups.ts set-privacy ~ship/group-slug public|private|secret
```

**Accept join requests (for private groups):**
```bash
npx ts-node scripts/groups.ts accept-join ~ship/group-slug ~requester1 ~requester2
```

**Reject join requests:**
```bash
npx ts-node scripts/groups.ts reject-join ~ship/group-slug ~requester1 ~requester2
```

### Role Management

**Add a role:**
```bash
npx ts-node scripts/groups.ts add-role ~ship/group-slug role-id --title "Role Name" [--description "..."]
```

**Delete a role:**
```bash
npx ts-node scripts/groups.ts delete-role ~ship/group-slug role-id
```

**Assign role to members:**
```bash
npx ts-node scripts/groups.ts assign-role ~ship/group-slug role-id ~member1 ~member2
```

**Remove role from members:**
```bash
npx ts-node scripts/groups.ts remove-role ~ship/group-slug role-id ~member1 ~member2
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

**Get recent messages from a channel:**
```bash
npx ts-node scripts/messages.ts channel chat/~host/channel-slug --limit 20
```

**Fetch full message history (same as channel):**
```bash
npx ts-node scripts/messages.ts history "chat/~host/channel-slug" --limit 50
```

**Search messages in a channel:**
```bash
npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-name
```

Channel format:
- DMs: `chat/~ship/dm` (auto-converted from `dm ~ship`)
- Group channels: `chat/~host/channel-slug`
- Examples: `chat/~nocsyx-lassul/bongtable`, `chat/~host/general`

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

### OpenClaw Settings (Hot-Reload Config)

Manage OpenClaw's Tlon plugin settings via Urbit's settings-store. Changes apply immediately without gateway restart.

**View current settings:**
```bash
npx ts-node scripts/settings.ts get
```

**Allow a ship to DM the bot:**
```bash
npx ts-node scripts/settings.ts allow-dm ~nocsyx-lassul
```

**Remove DM access:**
```bash
npx ts-node scripts/settings.ts remove-dm ~sampel-palnet
```

**Add a channel to watch:**
```bash
npx ts-node scripts/settings.ts allow-channel chat/~nocsyx-lassul/bongtable
```

**Open a channel to all (anyone can interact):**
```bash
npx ts-node scripts/settings.ts open-channel chat/~nocsyx-lassul/bongtable
```

**Restrict a channel to specific ships:**
```bash
npx ts-node scripts/settings.ts restrict-channel chat/~host/channel ~ship1 ~ship2
```

**Authorize a ship for commands (default auth):**
```bash
npx ts-node scripts/settings.ts authorize-ship ~nocsyx-lassul
```

**Set arbitrary setting:**
```bash
npx ts-node scripts/settings.ts set showModelSig true
npx ts-node scripts/settings.ts set autoDiscover false
```

Settings are stored in `%settings-store` under desk `moltbot`, bucket `tlon`. The Tlon plugin subscribes to changes and applies them immediately.

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## Notes

- All ship names should include the `~` prefix (scripts will normalize if missing)
- Profile updates sync to peers automatically via the contacts agent
- Post IDs are Unix timestamps in milliseconds
- For sending messages via the OpenClaw message tool, use `channel=tlon`
- Channel nests follow format: `<kind>/~<host>/<name>` where kind is chat, diary, or heap
