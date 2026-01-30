---
name: tlon
description: Access Tlon/Urbit via the tlon-run tool. Use for checking activity, listing channels/groups, fetching message history, looking up contacts, and performing actions.
---

# Tlon Skill

Use the `tlon-run` command for all Tlon operations.

**Do NOT use `npx`, `ts-node`, `npm`, `bash`, `sh`, or any other shell commands.**

## Ship Selection

Multiple ships can be registered via json files in the config dir. Check `skills/tlon/ships/` to see the list of available ships.

If only one ship is configured, it is auto-detected. With multiple ships, you must specify which one using `--ship` **before** the command:

```bash
tlon-run --ship ~sampel-palnet activity mentions
tlon-run --ship ~sampel-palnet click get-code
```

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
tlon-run groups list                                                          # List your groups
tlon-run groups info ~host-ship/slug                                          # Get group details and members
tlon-run groups create "Group Name" [--description "..."]                     # Create a new group
tlon-run groups invite ~host-ship/slug ~invitee1 ~invitee2                    # Invite members
tlon-run groups leave ~host-ship/slug                                         # Leave a group
tlon-run groups add-channel ~host-ship/slug "Name" [--kind chat] [--description "..."]  # Add a channel
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

### Click (Ship Operations)

Low-level ship operations via synchronous khan threads. Output is returned raw, so it needs to be parsed.

```bash
tlon-run click get-code                                    # Get ship access code
tlon-run click get-vats                                    # Get installed desk versions
tlon-run click bump                                        # Bump kiln (force OTA check)
tlon-run click ota <local-desk> <remote-desk> ~source      # OTA update a desk
tlon-run click commit <desk>                               # Commit desk changes
tlon-run click mount <desk>                                # Mount a desk to filesystem
tlon-run click unmount <desk>                              # Unmount a desk
tlon-run click revive <desk>                               # Revive a suspended desk
tlon-run click merge-remote ~source <src-desk> <dst-desk>  # Merge remote desk
tlon-run click merge-to-kids                               # Merge %base into %kids
tlon-run click is-agent-running <agent>                    # Check if agent is running (0=yes, 1=no)
tlon-run click moon-key <moon-prefix>                      # Get boot key for a moon
tlon-run click get-remote-hash ~source <desk>              # Get desk hash from remote ship
tlon-run click dump-agent-eggs <agent>                     # Dump agent state to jam file
tlon-run click load-agent-eggs <agent>                     # Load agent state from jam file
tlon-run click force-join ~host/group-name                 # Force join a group
tlon-run click force-join-token ~host/group-name <token>   # Join with invite token
tlon-run click eval '<hoon thread>'                        # Run arbitrary Hoon thread
```

**Raw Hoon**

```bash
tlon-run click eval '=/  m  (strand ,vase)  (pure:m !>(~))'  # Run arbitrary Hoon thread
```

Pass a Hoon thread string directly to click, exactly as you would with `click -k <pier>`. No validation is applied to the Hoon text.

Note: Click output uses Urbit loobeans where `0` = true/yes and `1` = false/no.

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
