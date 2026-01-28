---
name: tlon
description: Interact with Tlon/Urbit beyond the channel plugin. Use for contacts (get/update profiles, nicknames, avatars), listing channels/groups, fetching message history, ship lookups, and model switching. Complements the Tlon channel - use this skill for read operations, profile management, and admin commands.
authorization:
  model: ships-only
  ships: ["~malmur-halmex"]  # Configure your authorized admin ships here
---

# Tlon Skill

Provides direct Urbit API access beyond what the Tlon channel plugin offers.

## Setup

Scripts require these environment variables (from gateway config):
- `URBIT_URL` - Ship URL (e.g., `https://myship.tlon.network`)
- `URBIT_SHIP` - Ship name (e.g., `~sampel-palnet`)
- `URBIT_CODE` - Ship access code

The skill reads these from your Tlon channel config automatically.

## Authorization

Model switching is restricted to authorized ships only. Configure in the skill metadata:

```yaml
authorization:
  model: ships-only
  ships: ["~your-ship", "~trusted-ship"]
```

This ensures only specified ships can change models, restart services, or perform admin operations.

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

### Model Switching (Authorized Ships Only)

**Task-Specific Model Switching:**

When an authorized ship requests a different model for a specific task, follow this workflow:

1. **Switch to requested model** (saves original automatically):
```bash
npx ts-node scripts/model.ts opus        # Claude Opus 4.5
npx ts-node scripts/model.ts sonnet      # Claude Sonnet 4.5
npx ts-node scripts/model.ts haiku       # Claude Haiku 4.5
npx ts-node scripts/model.ts gemini      # Gemini 3 Pro
```

2. **Complete the task** using the new model

3. **Restore original model** after task completion:
```bash
npx ts-node scripts/model.ts restore
```

4. **Check if model override is active:**
```bash
npx ts-node scripts/model.ts state
```

**Gateway restart required** for model changes to take effect:
```bash
clawdbot gateway restart
```

**Example Workflow:**
```
User: "Use opus to analyze this complex architecture"
Bot: → Runs: npx ts-node scripts/model.ts opus
Bot: → Restarts gateway (if needed)
Bot: → Analyzes architecture with opus
Bot: → Runs: npx ts-node scripts/model.ts restore
Bot: → Returns to default model (sonnet)
```

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## Notes

- All ship names should include the `~` prefix
- Profile updates sync to peers automatically via the contacts agent
- This skill is read-heavy; for sending messages, use the `message` tool with `channel=tlon`
- **Model switching is restricted to authorized ships only** - configure in skill metadata under `authorization.ships`
- Task-specific model switching automatically saves/restores the original model
- Gateway restart is required for model changes to take effect
