---
name: tlon
description: Access Tlon/Urbit via the tlon-run tool. Use for checking activity, listing channels/groups, fetching message history, looking up contacts, posting to channels, sending DMs, and performing ship operations. Complements the Tlon channel plugin.
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

List and manage channels.

```bash
tlon-run channels dms                                          # List DM contacts
tlon-run channels group-dms                                    # List group DMs (clubs)
tlon-run channels groups                                       # List subscribed groups with channels
tlon-run channels all                                          # List everything
tlon-run channels info chat/~host/slug                         # Get channel details
tlon-run channels update chat/~host/slug --title "New Title"   # Update channel metadata
tlon-run channels delete chat/~host/slug                       # Delete a channel
```

### Contacts

Manage contacts and profiles.

```bash
tlon-run contacts list                                   # List all contacts
tlon-run contacts self                                   # Get your own profile
tlon-run contacts get ~sampel                            # Get a contact's profile
tlon-run contacts sync ~ship1 ~ship2                     # Fetch/sync profiles
tlon-run contacts add ~sampel                            # Add a contact
tlon-run contacts remove ~sampel                         # Remove a contact
tlon-run contacts update-profile --nickname "My Name"    # Update your profile
```

`update-profile` options: `--nickname`, `--bio`, `--status`, `--avatar`, `--cover`

### Groups

Full group management.

```bash
# Basics
tlon-run groups list                                         # List your groups
tlon-run groups info ~host/slug                              # Get group details
tlon-run groups create "Name" [--description "..."]          # Create a group
tlon-run groups join ~host/slug                              # Join a group
tlon-run groups leave ~host/slug                             # Leave a group
tlon-run groups delete ~host/slug                            # Delete a group (host only)
tlon-run groups update ~host/slug --title "..." [--description "..."] [--image "..."]

# Members
tlon-run groups invite ~host/slug ~ship1 ~ship2              # Invite members
tlon-run groups kick ~host/slug ~ship1                       # Kick members
tlon-run groups ban ~host/slug ~ship1                        # Ban members
tlon-run groups unban ~host/slug ~ship1                      # Unban members
tlon-run groups accept-join ~host/slug ~ship1                # Accept join request
tlon-run groups reject-join ~host/slug ~ship1                # Reject join request
tlon-run groups set-privacy ~host/slug public|private|secret # Set privacy

# Roles
tlon-run groups add-role ~host/slug role-id --title "..."    # Create a role
tlon-run groups delete-role ~host/slug role-id               # Delete a role
tlon-run groups update-role ~host/slug role-id --title "..." # Update a role
tlon-run groups assign-role ~host/slug role-id ~ship1        # Assign role to members
tlon-run groups remove-role ~host/slug role-id ~ship1        # Remove role from members

# Channels
tlon-run groups add-channel ~host/slug "Name" [--kind chat|diary|heap] [--description "..."]
```

Group format: `~host-ship/group-slug` (e.g., `~nocsyx-lassul/bongtable`)

### Messages

Read and search message history.

```bash
tlon-run messages dm ~sampel --limit 20                      # DM history (limit <= 50)
tlon-run messages channel chat/~host/slug --limit 20         # Channel history (limit <= 50)
tlon-run messages history chat/~host/slug --limit 20         # Same as channel
tlon-run messages search "query" --channel chat/~host/slug   # Search messages
```

Options: `--limit N`, `--resolve-cites` (resolve quoted messages)

### DMs

Send and manage direct messages.

```bash
tlon-run dms send ~sampel "hello"                # Send a DM
tlon-run dms send <club-id> "hello"              # Send to group DM (0v... id)
tlon-run dms reply ~sampel <post-id> "reply"     # Reply to a DM
tlon-run dms react ~sampel <post-id> <emoji>     # React to a DM
tlon-run dms unreact ~sampel <post-id>           # Remove reaction
tlon-run dms delete ~sampel <post-id>            # Delete a DM
tlon-run dms accept ~sampel                      # Accept DM invite
tlon-run dms decline ~sampel                     # Decline DM invite
```

### Posts

Post to channels (chat, diary, heap).

```bash
tlon-run posts send chat/~host/slug "message"              # Post to channel
tlon-run posts reply chat/~host/slug <post-id> "reply"     # Reply to a post
tlon-run posts react chat/~host/slug <post-id> <emoji>     # React to a post
tlon-run posts unreact chat/~host/slug <post-id>           # Remove reaction
tlon-run posts delete chat/~host/slug <post-id>            # Delete a post
```

### Notebook

Post to diary/notebook channels.

```bash
tlon-run notebook diary/~host/slug "Title"                   # Post with no body
tlon-run notebook diary/~host/slug "Title" --content file.md  # Post from file
tlon-run notebook diary/~host/slug "Title" --stdin            # Post from stdin
tlon-run notebook diary/~host/slug "Title" --image <url>      # Post with image
```

### Settings

Manage bot settings (settings-store).

```bash
# General
tlon-run settings get                                        # Show all settings
tlon-run settings set <key> <json-value>                     # Set a value
tlon-run settings delete <key>                               # Delete a setting

# DM allowlist
tlon-run settings allow-dm ~ship                             # Add to DM allowlist
tlon-run settings remove-dm ~ship                            # Remove from DM allowlist

# Channel controls
tlon-run settings allow-channel chat/~host/slug              # Add to watch list
tlon-run settings remove-channel chat/~host/slug             # Remove from watch list
tlon-run settings open-channel chat/~host/slug               # Set channel to open
tlon-run settings restrict-channel chat/~host/slug [~ship1]  # Set restricted

# Authorization
tlon-run settings authorize-ship ~ship                       # Add to default auth
tlon-run settings deauthorize-ship ~ship                     # Remove from default auth
```

Channel format: `{chat|diary|heap}/~host-ship/channel-slug`

Examples:
- `chat/~nocsyx-lassul/general`
- `diary/~sampel-palnet/blog`

### Workspace Files

Edit your own workspace files (SOUL.md, USER.md, TOOLS.md, AGENTS.md, etc.).

```bash
tlon-run soul read                    # Read SOUL.md
tlon-run soul replace "short text"    # Replace from argument (simple strings only)
tlon-run soul append "short note"     # Append from argument

# For multiline / markdown content, pipe via stdin (preferred):
cat <<'EOF' | tlon-run soul replace -
# My Heading

Paragraph with **markdown** and multiple lines.
EOF

echo "one-liner" | tlon-run memory append -

tlon-run user read                    # Same operations for USER.md
tlon-run tools read                   # TOOLS.md
tlon-run agents read                  # AGENTS.md
tlon-run heartbeat read               # HEARTBEAT.md
tlon-run identity read                # IDENTITY.md
tlon-run memory read                  # MEMORY.md
```

Content persists across sessions. Pass `-` (or omit the content arg) to read from stdin — **always use stdin for multiline content** to avoid shell quoting issues.

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

### OpenClaw Settings (Hot-Reload Config)

Manage OpenClaw's Tlon plugin settings via Urbit's settings-store. Changes apply immediately without gateway restart.

## Limits

- Activity commands: max 25 items
- Message commands: max 50 items
- All limits must be positive integers

## Safety Rules

1. Use the `tlon-run` commands listed above for all standard operations
2. The `npx ts-node scripts/...` commands below are available **only if you have exec/bash tool access** — most deployments restrict this
3. All inputs are validated; invalid formats will be rejected

## Error Handling

If a command fails:
- Check the ship/group/channel format matches the examples
- Ensure the resource exists and you have access
- Limits must be within the allowed range

## Notes

- All ship names should include the `~` prefix (scripts will normalize if missing)
- Post IDs are Unix timestamps in milliseconds
- For sending messages via the OpenClaw message tool, use `channel=tlon`
- Channel nests follow format: `<kind>/~<host>/<name>` where kind is chat, diary, or heap
- Profile updates sync to peers automatically via the contacts agent

## Direct Script Access (requires exec permission)

> **These commands require `bash`/`exec` tool access.** Most bot deployments only have the `tlon_run` tool — use the `tlon-run` commands above instead. Only use these if you have confirmed exec access.

Scripts require these environment variables (from gateway config):
- `URBIT_URL` - Ship URL (e.g., `https://myship.tlon.network`)
- `URBIT_SHIP` - Ship name (e.g., `~sampel-palnet`)
- `URBIT_CODE` - Ship access code

The skill reads these from your Tlon channel config automatically.

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
npx ts-node scripts/posts.ts react chat/~host/channel-name <post-id> <emoji>
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
npx ts-node scripts/dms.ts react ~sampel-palnet <post-id> <emoji>
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
