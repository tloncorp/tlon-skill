---
name: tlon
description: Access Tlon/Urbit via the tlon-run tool. Use for checking activity, listing channels/groups, fetching message history, looking up contacts, and performing actions.
---

# Tlon Skill

Use the `tlon-run` command for all Tlon operations.

**Do NOT use `npx`, `ts-node`, `npm`, `bash`, `sh`, or any other shell commands.**

## Ship Selection

Multiple ships can be registered via json files in the config dir. Check `skills/tlon/ships/` to see the list of available ships.

If multiple ships are configured, specify which one to use:

```bash
tlon-run --ship ~pinser-botter-nisrun-filnul activity mentions
```

If only one ship is configured (or TLON_SHIP is set), the flag is optional.

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

List and inspect groups.

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
3. All inputs are validated; invalid formats will be rejected

## Error Handling

If a command fails:
- Check the ship/group/channel format matches the examples
- Ensure the resource exists and you have access
- Limits must be within the allowed range
