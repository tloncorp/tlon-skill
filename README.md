# Tlon Skill

A [OpenClaw](https://github.com/openclaw/openclaw) skill for interacting with Tlon/Urbit beyond the channel plugin.

## Features

- **Groups**: Full group administration (create, invite, kick, ban, roles, privacy)
- **Channels**: List, create, update, delete channels
- **Posts**: Send messages, reply, react, delete in channels
- **DMs**: Send direct messages, manage DM requests
- **Messages**: Fetch message history with quote/cite resolution
- **Activity**: View mentions, replies, and unread notifications
- **Contacts**: List, get, and update contact profiles
- **Settings**: Hot-reload Moltbot/OpenClaw plugin config via settings-store
- **Click**: Low-level ship operations (OTA, desk management, group admin, DMs, etc.) via the `click` protocol

---

## Deployment (Hosted / K8s)

For hosted moltbot deployments where the agent should not have exec privileges, use the `tlon-run` wrapper which provides a safe, validated interface.

With multiple ships configured, `--ship` must come **before** the command:

```bash
tlon-run --ship ~sampel-palnet groups list
tlon-run --ship ~sampel-palnet click get-code
```

### Installation

```bash
# In your container/pod
./install.sh
```

Or in a Dockerfile:

```dockerfile
COPY tlon-skill /usr/local/share/moltbot/skills/tlon
WORKDIR /usr/local/share/moltbot/skills/tlon
RUN npm ci && ln -s /usr/local/share/moltbot/skills/tlon/bin/tlon-run /usr/local/bin/tlon-run
```

### Moltbot Configuration

Configure moltbot to use the `tlon` tool (which calls `tlon-run`) while denying exec/bash:

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/usr/local/share/moltbot/skills"]
    }
  },
  "tools": {
    "allow": ["tlon_run", "web_fetch", "web_search", "read"],
    "deny": ["exec", "bash", "process", "write", "edit"]
  }
}
```

### Ship config

Set these in your pod/container:

```bash
URBIT_URL="http://127.0.0.1:8080"  # Urbit ship in same pod
URBIT_SHIP="~your-ship"
URBIT_CODE="sampel-ticlyt-migfun-falmel"
```

Or if you have more than one ship, you can create json objects for them in `<skill dir>/ships/<ship>.json`:
```json
{
  "ship": "sampel-palnet",
  "url": "http://localhost:8080",
  "code": "sampel-palnet-sampel-dozzod",
  "pierPath": "/path/to/pier"
}
```

---

## Commands Reference

### Activity / Notifications

View mentions, replies, and unread counts.

```bash
tlon-run activity mentions --limit 10   # Recent mentions (limit <= 25)
tlon-run activity replies --limit 10    # Recent replies (limit <= 25)
tlon-run activity all --limit 10        # All recent activity (limit <= 25)
tlon-run activity unreads               # Unread counts per channel
```

---

### Channels

List and manage channels.

```bash
tlon-run channels dms                                          # List DM contacts
tlon-run channels group-dms                                    # List group DMs (clubs)
tlon-run channels groups                                       # List subscribed groups with channels
tlon-run channels all                                          # List everything
tlon-run channels info chat/~host/channel-name                 # Get channel details
tlon-run channels update chat/~host/channel --title "New Title" --description "..."
tlon-run channels delete chat/~host/channel                    # Delete a channel (admin only)
```

---

### Contacts

Manage your contact list and profile.

```bash
tlon-run contacts list                                   # List all contacts
tlon-run contacts self                                   # Get your own profile
tlon-run contacts get ~sampel-palnet                     # Get a contact's profile
tlon-run contacts sync ~ship1 ~ship2                     # Fetch/sync profiles
tlon-run contacts add ~sampel-palnet                     # Add a contact
tlon-run contacts remove ~sampel-palnet                  # Remove a contact
tlon-run contacts update-profile --nickname "My Name" --bio "About me"
tlon-run contacts update-profile --avatar "https://example.com/avatar.png"
```

`update-profile` options: `--nickname`, `--bio`, `--status`, `--avatar`, `--cover`

---

### Groups

Group administration including membership, roles, and privacy.

```bash
# Basics
tlon-run groups list                                         # List your groups
tlon-run groups info ~host/group-name                        # Get group details
tlon-run groups create "My Group" --description "A cool group"
tlon-run groups update ~you/group --title "New Title" --description "..."
tlon-run groups delete ~you/group                            # Delete (must be host)
tlon-run groups join ~host/group
tlon-run groups leave ~host/group

# Members
tlon-run groups invite ~you/group ~friend1 ~friend2
tlon-run groups kick ~you/group ~ship
tlon-run groups ban ~you/group ~ship
tlon-run groups unban ~you/group ~ship
tlon-run groups accept-join ~you/group ~ship                 # For private groups
tlon-run groups reject-join ~you/group ~ship
tlon-run groups set-privacy ~you/group public|private|secret

# Roles
tlon-run groups add-role ~you/group my-role --title "Moderator" --description "..."
tlon-run groups update-role ~you/group my-role --title "New Title"
tlon-run groups delete-role ~you/group my-role
tlon-run groups assign-role ~you/group my-role ~member1 ~member2
tlon-run groups remove-role ~you/group my-role ~member

# Channels in Groups
tlon-run groups add-channel ~you/group "General Chat" --kind chat --description "..."
```

Group format: `~host-ship/group-slug` (e.g., `~nocsyx-lassul/bongtable`)

---

### Messages (History)

Fetch message history with optional quote/cite resolution.

```bash
tlon-run messages dm ~sampel-palnet --limit 20               # DM history (limit <= 50)
tlon-run messages channel chat/~host/channel --limit 20      # Channel history (limit <= 50)
tlon-run messages history chat/~host/channel --limit 20      # Same as channel
tlon-run messages search "query" --channel chat/~host/channel
```

Options: `--limit N`, `--resolve-cites` (resolve quoted messages)

---

### Posts (Channel Messages)

Send messages to channels (chat, diary, heap).

```bash
tlon-run posts send chat/~host/channel "Hello world!"
tlon-run posts reply chat/~host/channel 170.141... "My reply"
tlon-run posts react chat/~host/channel 170.141... "👍"
tlon-run posts unreact chat/~host/channel 170.141...
tlon-run posts delete chat/~host/channel 170.141...
```

---

### DMs (Direct Messages)

Send and manage direct messages.

```bash
tlon-run dms send ~sampel-palnet "Hello!"
tlon-run dms send <club-id> "Hello!"                         # Group DM (0v... id)
tlon-run dms reply ~sampel-palnet 170.141... "My reply"
tlon-run dms react ~sampel-palnet 170.141... "❤️"
tlon-run dms unreact ~sampel-palnet 170.141...
tlon-run dms delete ~sampel-palnet 170.141...
tlon-run dms accept ~sampel-palnet
tlon-run dms decline ~sampel-palnet
```

---

### Notebook Posts

Post to diary/notebook channels.

```bash
tlon-run notebook diary/~host/channel "Post Title"
tlon-run notebook diary/~host/channel "Post Title" --content file.md
tlon-run notebook diary/~host/channel "Post Title" --stdin
tlon-run notebook diary/~host/channel "Post Title" --image <url>
```

---

### Settings (OpenClaw Plugin Config)

Manage OpenClaw's Tlon plugin config via Urbit settings-store. Changes apply immediately without gateway restart.

```bash
# General
tlon-run settings get           # Show all settings
tlon-run settings set           # Set a value
tlon-run settings delete        # Delete a setting

# DM allowlist (ships that can DM the bot)
tlon-run settings allow-dm ~friend
tlon-run settings remove-dm ~friend

# Channel watch list (channels the bot monitors)
tlon-run settings allow-channel chat/~host/channel
tlon-run settings remove-channel chat/~host/channel

# Per-channel access rules
tlon-run settings open-channel chat/~host/channel               # Anyone can interact
tlon-run settings restrict-channel chat/~host/channel [~ship1]  # Only listed ships

# Default authorized ships (global allowlist for bot interaction)
tlon-run settings authorize-ship ~ship                          # Add to global allowlist
tlon-run settings deauthorize-ship ~ship                        # Remove from global allowlist
```

Channel format: `{chat|diary|heap}/~host-ship/channel-slug`

---

### Click (Ship Operations)

The `click` subcommand wraps the Urbit `click` binary to run Hoon threads directly on the ship's pier. This requires the `pierPath` field in the ship config (set automatically by `sidecar-init`).

```bash
tlon-run click get-code                                        # Get ship access code
tlon-run click get-vats                                        # Get installed desk versions
tlon-run click bump                                            # Force OTA check
tlon-run click ota base kids ~datfen                           # OTA update a desk
tlon-run click mount base                                      # Mount desk to filesystem
tlon-run click unmount base                                    # Unmount desk
tlon-run click commit base                                     # Commit desk changes
tlon-run click revive groups                                   # Revive a suspended desk
tlon-run click is-agent-running groups                         # Check if agent is running
tlon-run click moon-key doznec                                 # Get boot key for a moon
tlon-run click merge-remote ~datfen base kids                  # Merge remote desk
tlon-run click merge-to-kids                                   # Merge %base into %kids
tlon-run click get-remote-hash ~datfen base                    # Get desk hash from remote
tlon-run click dump-agent-eggs chat                            # Dump agent state
tlon-run click load-agent-eggs chat                            # Load agent state
tlon-run click force-join ~host-ship/group-name                # Join a group
tlon-run click force-join-token ~host-ship/group-name 0v1.abc  # Join with invite token
tlon-run click eval $'=/  m  (strand ,vase)  (pure:m !>(~))'    # Run arbitrary Hoon thread
```

Output is returned raw from click. Urbit loobeans: `0` = true, `1` = false.

---

## Notes

- All ship names should include the `~` prefix (scripts will normalize if missing)
- Post IDs are Unix timestamps in milliseconds
- Channel nests follow format: `<kind>/~<host>/<name>` where kind is chat, diary, or heap
- Profile updates sync to peers automatically via the contacts agent

## Limits

- Activity commands: max 25 items
- Message commands: max 50 items
- All limits must be positive integers

---

## Complements the Tlon Plugin

This skill handles API operations, history retrieval, and administration. For real-time messaging and bot responses, use the [Tlon channel plugin](https://github.com/tloncorp/openclaw-tlon).

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

---

## Local Development (requires exec permission)

> ⚠️ **These commands require `bash`/`exec` tool access.** Most bot deployments only have the `tlon_run` tool — use the `tlon-run` commands above instead. Only use these if you have confirmed exec access and are doing local development.

### Setup

```bash
git clone https://github.com/tloncorp/tlon-skill.git
cd tlon-skill
npm install
```

### Configuration

```bash
export URBIT_URL="https://your-ship.tlon.network"
export URBIT_SHIP="~your-ship"
export URBIT_CODE="sampel-ticlyt-migfun-falmel"  # Your +code
```

The skill also reads credentials from OpenClaw's config if environment variables aren't set.

### Direct Script Commands

> **Prefer `tlon-run`** for all operations. This reference exists for local development and to map `npx` commands to their `tlon-run` equivalents.

```bash
# Activity / Notifications
npx ts-node scripts/activity.ts mentions --limit 10            # -> tlon-run activity mentions
npx ts-node scripts/activity.ts replies --limit 10             # -> tlon-run activity replies
npx ts-node scripts/activity.ts all --limit 10                 # -> tlon-run activity all
npx ts-node scripts/activity.ts unreads                        # -> tlon-run activity unreads

# Channels
npx ts-node scripts/channels.ts dms                            # -> tlon-run channels dms
npx ts-node scripts/channels.ts group-dms                      # -> tlon-run channels group-dms
npx ts-node scripts/channels.ts groups                         # -> tlon-run channels groups
npx ts-node scripts/channels.ts info chat/~host/slug           # -> tlon-run channels info
npx ts-node scripts/channels.ts update chat/~host/slug --title "..." # -> tlon-run channels update
npx ts-node scripts/channels.ts delete chat/~host/slug         # -> tlon-run channels delete

# Contacts / Profiles
npx ts-node scripts/contacts.ts list                           # -> tlon-run contacts list
npx ts-node scripts/contacts.ts self                           # -> tlon-run contacts self
npx ts-node scripts/contacts.ts get ~sampel                    # -> tlon-run contacts get
npx ts-node scripts/contacts.ts sync ~ship1 ~ship2             # -> tlon-run contacts sync
npx ts-node scripts/contacts.ts add ~sampel                    # -> tlon-run contacts add
npx ts-node scripts/contacts.ts remove ~sampel                 # -> tlon-run contacts remove
npx ts-node scripts/contacts.ts update-profile --nickname "My Name"   # -> tlon-run contacts update-profile
npx ts-node scripts/contacts.ts update-profile --bio "About me"
npx ts-node scripts/contacts.ts update-profile --status "Available"
npx ts-node scripts/contacts.ts update-profile --avatar "https://..."
npx ts-node scripts/contacts.ts update-profile --cover "https://..."

# Groups (basics)
npx ts-node scripts/groups.ts list                             # -> tlon-run groups list
npx ts-node scripts/groups.ts info ~host/slug                  # -> tlon-run groups info
npx ts-node scripts/groups.ts create "Name" --description "..." # -> tlon-run groups create
npx ts-node scripts/groups.ts join ~host/slug                  # -> tlon-run groups join
npx ts-node scripts/groups.ts leave ~host/slug                 # -> tlon-run groups leave
npx ts-node scripts/groups.ts delete ~host/slug                # -> tlon-run groups delete
npx ts-node scripts/groups.ts update ~host/slug --title "..." --description "..." --image "..."

# Groups (members / moderation)
npx ts-node scripts/groups.ts invite ~host/slug ~ship1 ~ship2  # -> tlon-run groups invite
npx ts-node scripts/groups.ts kick ~host/slug ~ship1           # -> tlon-run groups kick
npx ts-node scripts/groups.ts ban ~host/slug ~ship1            # -> tlon-run groups ban
npx ts-node scripts/groups.ts unban ~host/slug ~ship1          # -> tlon-run groups unban
npx ts-node scripts/groups.ts accept-join ~host/slug ~ship1    # -> tlon-run groups accept-join
npx ts-node scripts/groups.ts reject-join ~host/slug ~ship1    # -> tlon-run groups reject-join
npx ts-node scripts/groups.ts set-privacy ~host/slug public    # -> tlon-run groups set-privacy

# Groups (roles)
npx ts-node scripts/groups.ts add-role ~host/slug role-id --title "Role Name"
npx ts-node scripts/groups.ts delete-role ~host/slug role-id
npx ts-node scripts/groups.ts update-role ~host/slug role-id --title "New Title"
npx ts-node scripts/groups.ts assign-role ~host/slug role-id ~ship1 ~ship2
npx ts-node scripts/groups.ts remove-role ~host/slug role-id ~ship1 ~ship2

# Groups (channels)
npx ts-node scripts/groups.ts add-channel ~host/slug "Name" --kind chat --description "..."

# Messages (read/search)
npx ts-node scripts/messages.ts dm ~sampel --limit 20          # -> tlon-run messages dm
npx ts-node scripts/messages.ts channel chat/~host/slug --limit 20 # -> tlon-run messages channel
npx ts-node scripts/messages.ts history chat/~host/slug --limit 20 # -> tlon-run messages history
npx ts-node scripts/messages.ts search "query" --channel chat/~host/slug

# Posts (channel posting)
npx ts-node scripts/posts.ts send chat/~host/slug "message"    # -> tlon-run posts send
npx ts-node scripts/posts.ts reply chat/~host/slug <id> "reply" # -> tlon-run posts reply
npx ts-node scripts/posts.ts react chat/~host/slug <id> 👍      # -> tlon-run posts react
npx ts-node scripts/posts.ts unreact chat/~host/slug <id>       # -> tlon-run posts unreact
npx ts-node scripts/posts.ts delete chat/~host/slug <id>        # -> tlon-run posts delete

# Direct Messages
npx ts-node scripts/dms.ts send ~sampel "hello"                # -> tlon-run dms send
npx ts-node scripts/dms.ts send 0v4.club-id "hello"            # -> tlon-run dms send (group DM)
npx ts-node scripts/dms.ts reply ~sampel <id> "reply"          # -> tlon-run dms reply
npx ts-node scripts/dms.ts react ~sampel <id> 👍                # -> tlon-run dms react
npx ts-node scripts/dms.ts unreact ~sampel <id>                 # -> tlon-run dms unreact
npx ts-node scripts/dms.ts delete ~sampel <id>                  # -> tlon-run dms delete
npx ts-node scripts/dms.ts accept ~sampel                      # -> tlon-run dms accept
npx ts-node scripts/dms.ts decline ~sampel                     # -> tlon-run dms decline

# Notebook / Diary posting
npx ts-node scripts/notebook-post.ts diary/~host/slug "Title"  # -> tlon-run notebook
npx ts-node scripts/notebook-post.ts diary/~host/slug "Title" --image https://...
npx ts-node scripts/notebook-post.ts diary/~host/slug "Title" --content article.json
echo '...' | npx ts-node scripts/notebook-post.ts diary/~host/slug "Title" --stdin

# Settings (hot-reload config)
npx ts-node scripts/settings.ts get                            # -> tlon-run settings get
npx ts-node scripts/settings.ts set showModelSig true          # -> tlon-run settings set
npx ts-node scripts/settings.ts delete <key>                   # -> tlon-run settings delete
npx ts-node scripts/settings.ts allow-dm ~ship                 # -> tlon-run settings allow-dm
npx ts-node scripts/settings.ts remove-dm ~ship                # -> tlon-run settings remove-dm
npx ts-node scripts/settings.ts allow-channel chat/~host/slug  # -> tlon-run settings allow-channel
npx ts-node scripts/settings.ts remove-channel chat/~host/slug # -> tlon-run settings remove-channel
npx ts-node scripts/settings.ts open-channel chat/~host/slug   # -> tlon-run settings open-channel
npx ts-node scripts/settings.ts restrict-channel chat/~host/slug ~ship1 ~ship2
npx ts-node scripts/settings.ts authorize-ship ~ship           # -> tlon-run settings authorize-ship
npx ts-node scripts/settings.ts deauthorize-ship ~ship         # -> tlon-run settings deauthorize-ship
```

Settings are stored in `%settings-store` under desk `moltbot`, bucket `tlon`. The Tlon plugin subscribes to changes and applies them immediately.

---

## License

MIT
