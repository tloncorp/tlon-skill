---
name: tlon
description: Read-only access to Tlon/Urbit data. Use for checking activity, listing channels/groups, fetching message history, and looking up contacts.
---

# Tlon Skill (Safe)

Use the `tlon-run` command for all Tlon read operations.

**Do NOT use `npx`, `ts-node`, `npm`, `bash`, `sh`, or any other shell commands.**

## Commands

### Activity

Check recent notifications and unread counts.

```bash
tlon-run activity mentions --limit 10   # Recent mentions (limit <= 25)
tlon-run activity replies --limit 10    # Recent replies (limit <= 25)
tlon-run activity all --limit 10        # All recent activity (limit <= 25)
tlon-run activity unreads               # Unread counts per channel
```

### Channels

List available channels and groups.

```bash
tlon-run channels dms        # List direct message contacts
tlon-run channels group-dms  # List group DMs (clubs)
tlon-run channels groups     # List subscribed groups with channels
tlon-run channels all        # List everything
```

### Contacts

Look up profiles and contacts.

```bash
tlon-run contacts list           # List all contacts
tlon-run contacts self           # Get your own profile
tlon-run contacts get ~sampel    # Get a specific contact's profile
```

Ship name format: `~prefix` or `~prefix-suffix` (e.g., `~zod`, `~sampel-palnet`)

### Groups

List and inspect groups (read-only).

```bash
tlon-run groups list                      # List your groups
tlon-run groups info ~host-ship/slug      # Get group details and members
```

Group format: `~host-ship/group-slug` (e.g., `~nocsyx-lassul/bongtable`)

### Messages

Fetch message history from channels.

```bash
tlon-run messages dm ~sampel-palnet --limit 20              # DM history (limit <= 50)
tlon-run messages channel chat/~host/channel --limit 20     # Channel history (limit <= 50)
tlon-run messages history chat/~host/channel --limit 20     # Same as channel
```

Channel format: `{chat|diary|heap}/~host-ship/channel-slug`

Examples:
- `chat/~nocsyx-lassul/general`
- `diary/~sampel-palnet/blog`

## Limits

- Activity commands: max 25 items
- Message commands: max 50 items
- All limits must be positive integers

## Safety Rules

1. Only use the `tlon-run` commands listed above
2. Never attempt to run `npx`, `npm`, `ts-node`, `bash`, `sh`, or other executables
3. This skill is read-only - no modifications to profiles, groups, or messages
4. All inputs are validated; invalid formats will be rejected

## Error Handling

If a command fails:
- Check the ship/group/channel format matches the examples
- Ensure the resource exists and you have access
- Limits must be within the allowed range
