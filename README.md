# Tlon Skill

A [Moltbot](https://github.com/moltbot/moltbot) skill for interacting with Tlon/Urbit beyond the channel plugin.

## Features

- **Groups**: Create groups, invite members, manage membership
- **Activity**: View mentions, replies, and unread notifications
- **Contacts**: List, get, and update contact profiles
- **Channels**: List channels and groups you have access to

## Installation

```bash
# Clone to your skills directory
git clone https://github.com/tloncorp/tlon-skill.git ~/clawd/skills/tlon

# Install dependencies
cd ~/clawd/skills/tlon
npm install
```

## Configuration

Set environment variables or configure in your Moltbot setup:

```bash
export URBIT_URL="https://your-ship.tlon.network"
export URBIT_SHIP="~your-ship"
export URBIT_CODE="sampel-ticlyt-migfun-falmel"  # Your +code
```

## Usage

### Groups

```bash
# List all your groups
npx ts-node scripts/groups.ts list

# Create a new group
npx ts-node scripts/groups.ts create "My Group" --description "A cool group"

# Get group info (members, channels, pending invites)
npx ts-node scripts/groups.ts info ~your-ship/group-slug

# Invite members to a group
npx ts-node scripts/groups.ts invite ~your-ship/group-slug ~friend1 ~friend2

# Leave a group
npx ts-node scripts/groups.ts leave ~host-ship/group-slug
```

### Activity / Notifications

```bash
# Get recent mentions (where you were @mentioned)
npx ts-node scripts/activity.ts mentions --limit 10

# Get recent replies to your posts
npx ts-node scripts/activity.ts replies --limit 10

# Get all recent activity
npx ts-node scripts/activity.ts all --limit 10

# Get unread counts by channel/group
npx ts-node scripts/activity.ts unreads
```

### Contacts

```bash
# List all contacts
npx ts-node scripts/contacts.ts list

# Get a specific contact's profile
npx ts-node scripts/contacts.ts get ~sampel-palnet

# Update your profile
npx ts-node scripts/contacts.ts update-profile --nickname "My Name" --bio "About me"

# Update your avatar
npx ts-node scripts/contacts.ts update-profile --avatar "https://example.com/avatar.png"
```

### Channels

```bash
# List DMs
npx ts-node scripts/channels.ts dms

# List group DMs
npx ts-node scripts/channels.ts group-dms

# List subscribed groups
npx ts-node scripts/channels.ts groups
```

### Channel Summarizer

Summarize recent activity in any channel with privacy controls. Private/secret channels can only be summarized by authorized ships.

```bash
# Summarize last 50 messages
npx ts-node scripts/summarize.ts --channel chat/~host/channel-name

# Summarize specific count
npx ts-node scripts/summarize.ts --channel chat/~host/channel-name --count 100

# Specify requester (defaults to URBIT_SHIP)
npx ts-node scripts/summarize.ts --channel chat/~host/channel-name --requester ~malmur-halmex
```

**Privacy Controls:**
- Public channels: Anyone can summarize
- Private/Secret channels: Only authorized ships (set via `SUMMARIZER_AUTH_SHIPS` env var)

**Example Output:**
```
📋 Channel Summary: chat/~dabben-larbet/hosting-6173
**Group:** ~dabben-larbet/tlon
**Privacy:** secret

**Period:** Last 38 messages
**Date Range:** 1/27/2026 to 1/29/2026

**Key Topics:**
- Prometheus
- Bot
- Hosting
- Feature

**Active Participants:** ~malmur-halmex, ~bitter-bitduc, ~sitful-hatred
```

## Complements the Tlon Plugin

This skill handles read operations, notifications, and group management. For messaging, use the [Tlon channel plugin](https://github.com/tloncorp/moltbot-tlon).

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## License

MIT
