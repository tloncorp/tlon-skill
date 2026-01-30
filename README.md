# Tlon Skill

A [Moltbot](https://github.com/moltbot/moltbot) skill for interacting with Tlon/Urbit beyond the channel plugin.

## Features

- **Groups**: Full group administration (create, invite, kick, ban, roles, privacy)
- **Channels**: List, create, update, delete channels
- **Posts**: Send messages, reply, react, delete in channels
- **DMs**: Send direct messages, manage DM requests
- **Messages**: Fetch message history with quote/cite resolution
- **Activity**: View mentions, replies, and unread notifications
- **Contacts**: List, get, and update contact profiles
- **Settings**: Hot-reload Moltbot plugin config via settings-store

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

The skill also reads credentials from Moltbot's config if environment variables aren't set.

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

# Get a specific contact's profile
npx ts-node scripts/contacts.ts get ~sampel-palnet

# Update your profile
npx ts-node scripts/contacts.ts update-profile --nickname "My Name" --bio "About me"

# Update your avatar
npx ts-node scripts/contacts.ts update-profile --avatar "https://example.com/avatar.png"
```

---

## Settings (Moltbot Plugin Config)

Manage Moltbot's Tlon plugin config via Urbit settings-store. Changes apply immediately without gateway restart.

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

This skill handles API operations, history retrieval, and administration. For real-time messaging and bot responses, use the [Tlon channel plugin](https://github.com/tloncorp/moltbot-tlon).

## License

MIT
