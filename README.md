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

### Environment Variables

Set these in your pod/container:

```bash
URBIT_URL="http://127.0.0.1:8080"  # Urbit ship in same pod
URBIT_SHIP="~your-ship"
URBIT_CODE="sampel-ticlyt-migfun-falmel"
```

### Wrapper commands

See [SKILL.md](SKILL.md) for the complete list of wrapped commands:

```bash
tlon-run activity mentions --limit 10
tlon-run channels dms
tlon-run contacts get ~sampel-palnet
tlon-run groups list
tlon-run messages dm ~friend --limit 20
```

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
tlon-run click eval '=/  m  (strand ,vase)  (pure:m !>(~))'   # Run arbitrary Hoon thread
```

Output is returned raw from click. Urbit loobeans: `0` = true, `1` = false.

---

## Local Development

For local development with full access to all scripts:

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

---

## Groups

Full group administration including membership, roles, and privacy.

```bash
# List all your groups
npx ts-node scripts/groups.ts list

# Get group info (members, channels, roles, pending requests)
npx ts-node scripts/groups.ts info ~host/group-name

# Create a new group
npx ts-node scripts/groups.ts create "My Group" --description "A cool group"

# Update group metadata
npx ts-node scripts/groups.ts update ~you/group --title "New Title" --description "..."

# Delete a group (must be host)
npx ts-node scripts/groups.ts delete ~you/group

# Join/leave groups
npx ts-node scripts/groups.ts join ~host/group
npx ts-node scripts/groups.ts leave ~host/group
```

### Membership Management

```bash
# Invite members
npx ts-node scripts/groups.ts invite ~you/group ~friend1 ~friend2

# Kick members
npx ts-node scripts/groups.ts kick ~you/group ~ship

# Ban/unban ships
npx ts-node scripts/groups.ts ban ~you/group ~ship
npx ts-node scripts/groups.ts unban ~you/group ~ship

# Accept/reject join requests (for private groups)
npx ts-node scripts/groups.ts accept-join ~you/group ~ship
npx ts-node scripts/groups.ts reject-join ~you/group ~ship
```

### Roles

```bash
# Add a new role
npx ts-node scripts/groups.ts add-role ~you/group my-role --title "Moderator" --description "..."

# Update role metadata
npx ts-node scripts/groups.ts update-role ~you/group my-role --title "New Title"

# Delete a role
npx ts-node scripts/groups.ts delete-role ~you/group my-role

# Assign/remove roles from members
npx ts-node scripts/groups.ts assign-role ~you/group my-role ~member1 ~member2
npx ts-node scripts/groups.ts remove-role ~you/group my-role ~member
```

### Privacy

```bash
# Set group privacy (public, private, secret)
npx ts-node scripts/groups.ts set-privacy ~you/group private
```

### Channels in Groups

```bash
# Add a channel to a group
npx ts-node scripts/groups.ts add-channel ~you/group chat my-channel --title "General Chat"
```

---

## Channels

List and manage channels.

```bash
# List DMs
npx ts-node scripts/channels.ts dms

# List group DMs (clubs)
npx ts-node scripts/channels.ts group-dms

# List subscribed groups
npx ts-node scripts/channels.ts groups

# Get channel info
npx ts-node scripts/channels.ts info chat/~host/channel-name

# Update channel metadata
npx ts-node scripts/channels.ts update chat/~host/channel --title "New Title" --description "..."

# Delete a channel (must be group admin)
npx ts-node scripts/channels.ts delete chat/~host/channel
```

---

## Posts (Channel Messages)

Send messages to channels (chat, diary, heap).

```bash
# Send a message to a channel
npx ts-node scripts/posts.ts send chat/~host/channel "Hello world!"

# Reply to a post
npx ts-node scripts/posts.ts reply chat/~host/channel 170.141... "My reply"

# React to a post
npx ts-node scripts/posts.ts react chat/~host/channel 170.141... "👍"

# Remove reaction
npx ts-node scripts/posts.ts unreact chat/~host/channel 170.141...

# Delete a post
npx ts-node scripts/posts.ts delete chat/~host/channel 170.141...
```

---

## DMs (Direct Messages)

Send and manage direct messages.

```bash
# Send a DM
npx ts-node scripts/dms.ts send ~sampel-palnet "Hello!"

# Reply to a DM
npx ts-node scripts/dms.ts reply ~sampel-palnet 170.141... "My reply"

# React to a DM
npx ts-node scripts/dms.ts react ~sampel-palnet 170.141... "❤️"

# Remove reaction
npx ts-node scripts/dms.ts unreact ~sampel-palnet 170.141...

# Delete a DM
npx ts-node scripts/dms.ts delete ~sampel-palnet 170.141...

# Accept/decline DM requests
npx ts-node scripts/dms.ts accept ~sampel-palnet
npx ts-node scripts/dms.ts decline ~sampel-palnet
```

---

## Messages (History)

Fetch message history with optional quote/cite resolution.

```bash
# Fetch channel messages
npx ts-node scripts/messages.ts channel chat/~host/channel --limit 20

# Fetch DM history
npx ts-node scripts/messages.ts dm ~sampel-palnet --limit 20

# Resolve quoted messages (fetches cited content)
npx ts-node scripts/messages.ts channel chat/~host/channel --limit 10 --resolve-cites
```

---

## Activity / Notifications

View mentions, replies, and unread counts.

```bash
# Get recent mentions
npx ts-node scripts/activity.ts mentions --limit 10

# Get recent replies to your posts
npx ts-node scripts/activity.ts replies --limit 10

# Get all recent activity
npx ts-node scripts/activity.ts all --limit 10

# Get unread counts by channel/group
npx ts-node scripts/activity.ts unreads
```

---

## Contacts

Manage your contact list and profile.

```bash
# List all contacts
npx ts-node scripts/contacts.ts list

# Get your own profile
npx ts-node scripts/contacts.ts self

# Get a specific contact's profile
npx ts-node scripts/contacts.ts get ~sampel-palnet

# Update your profile
npx ts-node scripts/contacts.ts update-profile --nickname "My Name" --bio "About me"

# Update your avatar
npx ts-node scripts/contacts.ts update-profile --avatar "https://example.com/avatar.png"
```

---

## Settings (OpenClaw Plugin Config)

Manage OpenClaw's Tlon plugin config via Urbit settings-store. Changes apply immediately without gateway restart.

```bash
# View current settings
npx ts-node scripts/settings.ts get

# Set a value
npx ts-node scripts/settings.ts set showModelSig true

# Delete a setting
npx ts-node scripts/settings.ts delete showModelSig
```

### DM Allowlist

```bash
# Add ship to DM allowlist
npx ts-node scripts/settings.ts allow-dm ~friend

# Remove ship from DM allowlist
npx ts-node scripts/settings.ts remove-dm ~friend
```

### Channel Permissions

```bash
# Add ship to channel allowlist
npx ts-node scripts/settings.ts allow-channel chat/~host/channel ~ship

# Remove ship from channel allowlist
npx ts-node scripts/settings.ts remove-channel chat/~host/channel ~ship

# Set channel to open mode (anyone can trigger bot)
npx ts-node scripts/settings.ts open-channel chat/~host/channel

# Set channel to restricted mode (allowlist only)
npx ts-node scripts/settings.ts restrict-channel chat/~host/channel
```

---

## Notebook Posts

Post to diary/notebook channels.

```bash
npx ts-node scripts/notebook-post.ts ~host/group diary/~host/channel "Post Title" "Post content here..."
```

---

## Complements the Tlon Plugin

This skill handles API operations, history retrieval, and administration. For real-time messaging and bot responses, use the [Tlon channel plugin](https://github.com/tloncorp/openclaw-tlon).

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## License

MIT
