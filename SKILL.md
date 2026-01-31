---
name: tlon
description: Interact with Tlon/Urbit beyond the channel plugin. Use for contacts (get/update profiles, nicknames, avatars), listing channels/groups, fetching message history, posting to channels, sending DMs, and ship lookups. Complements the Tlon channel - use this skill for read operations, profile management, and direct API access.
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

The skill reads these from your Tlon channel config automatically

> ⚠️ **Legacy / Exec-only reference (do not run in agent environments):**
> These `npx ts-node scripts/*` commands **require shell/exec access** (`bash`, `exec`, etc.). Most deployments **do not allow this**.
> **Prefer `tlon-run`** for all operations. This block exists only so you can recognize and map them mentally to the `tlon-run` sections above.

```bash
# Activity / Notifications
npx ts-node scripts/activity.ts mentions --limit 10            # Recent mentions (limit <= 25)  -> tlon-run activity mentions
npx ts-node scripts/activity.ts replies --limit 10             # Recent replies (limit <= 25)   -> tlon-run activity replies
npx ts-node scripts/activity.ts all --limit 10                 # All recent activity (<= 25)    -> tlon-run activity all
npx ts-node scripts/activity.ts unreads                        # Unread counts per channel      -> tlon-run activity unreads

# Channels
npx ts-node scripts/channels.ts dms                            # List DM contacts               -> tlon-run channels dms
npx ts-node scripts/channels.ts group-dms                      # List group DMs (clubs)         -> tlon-run channels group-dms
npx ts-node scripts/channels.ts groups                         # List subscribed groups         -> tlon-run channels groups
npx ts-node scripts/channels.ts info chat/~host/slug           # Get channel details            -> tlon-run channels info
npx ts-node scripts/channels.ts update chat/~host/slug --title "New Title"   # Update channel metadata -> tlon-run channels update
npx ts-node scripts/channels.ts delete chat/~host/slug         # Delete channel (admin only)    -> tlon-run channels delete

# Contacts / Profiles
npx ts-node scripts/contacts.ts list                           # List all contacts              -> tlon-run contacts list
npx ts-node scripts/contacts.ts self                           # Get your profile               -> tlon-run contacts self
npx ts-node scripts/contacts.ts get ~sampel                    # Get a contact profile          -> tlon-run contacts get
npx ts-node scripts/contacts.ts sync ~ship1 ~ship2             # Fetch/sync profiles            -> tlon-run contacts sync
npx ts-node scripts/contacts.ts add ~sampel                    # Add a contact                  -> tlon-run contacts add
npx ts-node scripts/contacts.ts remove ~sampel                 # Remove a contact               -> tlon-run contacts remove
npx ts-node scripts/contacts.ts update-profile --nickname "My Name"          # Update your profile -> tlon-run contacts update-profile
npx ts-node scripts/contacts.ts update-profile --bio "About me"              # Update bio          -> tlon-run contacts update-profile
npx ts-node scripts/contacts.ts update-profile --status "Available"          # Update status       -> tlon-run contacts update-profile
npx ts-node scripts/contacts.ts update-profile --avatar "https://..."        # Update avatar       -> tlon-run contacts update-profile
npx ts-node scripts/contacts.ts update-profile --cover "https://..."         # Update cover        -> tlon-run contacts update-profile

# Groups (basics)
npx ts-node scripts/groups.ts list                             # List your groups               -> tlon-run groups list
npx ts-node scripts/groups.ts info ~host/slug                  # Get group details              -> tlon-run groups info
npx ts-node scripts/groups.ts create "Name" --description "..."# Create a group                 -> tlon-run groups create
npx ts-node scripts/groups.ts join ~host/slug                  # Join a group                   -> tlon-run groups join
npx ts-node scripts/groups.ts leave ~host/slug                 # Leave a group                  -> tlon-run groups leave
npx ts-node scripts/groups.ts delete ~host/slug                # Delete a group (host only)     -> tlon-run groups delete
npx ts-node scripts/groups.ts update ~host/slug --title "..." --description "..." --image "https://..."  # Update group -> tlon-run groups update

# Groups (members / moderation)
npx ts-node scripts/groups.ts invite ~host/slug ~ship1 ~ship2   # Invite members                -> tlon-run groups invite
npx ts-node scripts/groups.ts kick ~host/slug ~ship1            # Kick member                   -> tlon-run groups kick
npx ts-node scripts/groups.ts ban ~host/slug ~ship1             # Ban member                    -> tlon-run groups ban
npx ts-node scripts/groups.ts unban ~host/slug ~ship1           # Unban member                  -> tlon-run groups unban
npx ts-node scripts/groups.ts accept-join ~host/slug ~ship1     # Accept join request           -> tlon-run groups accept-join
npx ts-node scripts/groups.ts reject-join ~host/slug ~ship1     # Reject join request           -> tlon-run groups reject-join
npx ts-node scripts/groups.ts set-privacy ~host/slug public     # Set privacy                   -> tlon-run groups set-privacy
npx ts-node scripts/groups.ts set-privacy ~host/slug private    # Set privacy                   -> tlon-run groups set-privacy
npx ts-node scripts/groups.ts set-privacy ~host/slug secret     # Set privacy                   -> tlon-run groups set-privacy

# Groups (roles)
npx ts-node scripts/groups.ts add-role ~host/slug role-id --title "Role Name"      # Create role      -> tlon-run groups add-role
npx ts-node scripts/groups.ts delete-role ~host/slug role-id                        # Delete role      -> tlon-run groups delete-role
npx ts-node scripts/groups.ts update-role ~host/slug role-id --title "New Title"    # Update role      -> tlon-run groups update-role
npx ts-node scripts/groups.ts assign-role ~host/slug role-id ~ship1 ~ship2          # Assign role      -> tlon-run groups assign-role
npx ts-node scripts/groups.ts remove-role ~host/slug role-id ~ship1 ~ship2          # Remove role      -> tlon-run groups remove-role

# Groups (channels)
npx ts-node scripts/groups.ts add-channel ~host/slug "Name" --kind chat  --description "..."   # Add chat channel  -> tlon-run groups add-channel
npx ts-node scripts/groups.ts add-channel ~host/slug "Name" --kind diary --description "..."   # Add diary channel -> tlon-run groups add-channel
npx ts-node scripts/groups.ts add-channel ~host/slug "Name" --kind heap  --description "..."   # Add heap channel  -> tlon-run groups add-channel

# Messages (read/search)
npx ts-node scripts/messages.ts dm ~sampel --limit 20            # DM history (limit <= 50)      -> tlon-run messages dm
npx ts-node scripts/messages.ts channel chat/~host/slug --limit 20 # Channel history (<= 50)     -> tlon-run messages channel
npx ts-node scripts/messages.ts history chat/~host/slug --limit 20 # Same as channel/history     -> tlon-run messages history
npx ts-node scripts/messages.ts search "query" --channel chat/~host/slug  # Search messages       -> tlon-run messages search

# Posts (channel posting)
npx ts-node scripts/posts.ts send chat/~host/slug "message"       # Post to channel              -> tlon-run posts send
npx ts-node scripts/posts.ts reply chat/~host/slug 1700000000000 "reply" # Reply to post         -> tlon-run posts reply
npx ts-node scripts/posts.ts react chat/~host/slug 1700000000000 👍       # React to post         -> tlon-run posts react
npx ts-node scripts/posts.ts unreact chat/~host/slug 1700000000000        # Remove reaction       -> tlon-run posts unreact
npx ts-node scripts/posts.ts delete chat/~host/slug 1700000000000         # Delete post           -> tlon-run posts delete

# Direct Messages (send/reply/react/delete + invites)
npx ts-node scripts/dms.ts send ~sampel "hello"                   # Send a DM                   -> tlon-run dms send
npx ts-node scripts/dms.ts send 0v4.club-id "hello"               # Send to group DM (club)      -> tlon-run dms send
npx ts-node scripts/dms.ts reply ~sampel 1700000000000 "reply"    # Reply in DM thread           -> tlon-run dms reply
npx ts-node scripts/dms.ts react ~sampel 1700000000000 👍         # React to DM                  -> tlon-run dms react
npx ts-node scripts/dms.ts unreact ~sampel 1700000000000          # Remove DM reaction           -> tlon-run dms unreact
npx ts-node scripts/dms.ts delete ~sampel 1700000000000           # Delete a DM                  -> tlon-run dms delete
npx ts-node scripts/dms.ts accept ~sampel                         # Accept DM invite             -> tlon-run dms accept
npx ts-node scripts/dms.ts decline ~sampel                        # Decline DM invite            -> tlon-run dms decline

# Notebook / Diary posting
npx ts-node scripts/notebook-post.ts diary/~host/slug "Title"                    # Notebook post            -> tlon-run notebook diary/~host/slug "Title"
npx ts-node scripts/notebook-post.ts diary/~host/slug "Title" --image https://...# Notebook post w/ image   -> tlon-run notebook ... --image
npx ts-node scripts/notebook-post.ts diary/~host/slug "Title" --content article.json # Post from file       -> tlon-run notebook ... --content
echo '[{"inline":["Hello"]}]' | npx ts-node scripts/notebook-post.ts diary/~host/slug "Title" --stdin       # Post from stdin -> tlon-run notebook ... --stdin

# Settings (hot-reload config)
npx ts-node scripts/settings.ts get                               # Show all settings             -> tlon-run settings get
npx ts-node scripts/settings.ts allow-dm ~ship                    # Add to DM allowlist           -> tlon-run settings allow-dm
npx ts-node scripts/settings.ts remove-dm ~ship                   # Remove from DM allowlist      -> tlon-run settings remove-dm
npx ts-node scripts/settings.ts allow-channel chat/~host/slug     # Add to watch list             -> tlon-run settings allow-channel
npx ts-node scripts/settings.ts remove-channel chat/~host/slug    # Remove from watch list        -> tlon-run settings remove-channel
npx ts-node scripts/settings.ts open-channel chat/~host/slug      # Set channel to open           -> tlon-run settings open-channel
npx ts-node scripts/settings.ts restrict-channel chat/~host/slug ~ship1 ~ship2  # Restrict channel     -> tlon-run settings restrict-channel
npx ts-node scripts/settings.ts authorize-ship ~ship              # Add to default auth           -> tlon-run settings authorize-ship
npx ts-node scripts/settings.ts deauthorize-ship ~ship            # Remove from default auth      -> tlon-run settings deauthorize-ship
npx ts-node scripts/settings.ts set showModelSig true             # Set arbitrary setting         -> tlon-run settings set
npx ts-node scripts/settings.ts set autoDiscover false            # Set arbitrary setting         -> tlon-run settings set
npx ts-node scripts/settings.ts delete <key>                      # Delete a setting              -> tlon-run settings delete
```

Settings are stored in `%settings-store` under desk `moltbot`, bucket `tlon`. The Tlon plugin subscribes to changes and applies them immediately.

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.
