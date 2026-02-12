---
name: tlon
description: Interact with Tlon/Urbit API. Use for contacts (get/update profiles), listing channels/groups, fetching message history, posting to channels, sending DMs, and group management.
---

# Tlon Skill

Use the `tlon` command for all Tlon operations.

## Installation

**npm (Node.js):**
```bash
npm install @tloncorp/tlon-skill
tlon channels groups
```

**Direct binary (no Node required):**
```bash
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-arm64/-/tlon-skill-darwin-arm64-0.1.0.tgz | tar -xz
./package/tlon channels groups
```

Replace `darwin-arm64` with `darwin-x64` or `linux-x64` as needed.

## Configuration

**CLI Flags (highest priority):**
```bash
# Pass all three credentials directly
tlon --url https://your-ship.tlon.network --ship ~your-ship --code sampel-ticlyt-migfun-falmel <command>

# Or load from a JSON config file
tlon --config ~/ships/my-ship.json <command>
```

Config file format: `{"url": "...", "ship": "~...", "code": "..."}`

**Environment Variables:**
```bash
export URBIT_URL="https://your-ship.tlon.network"
export URBIT_SHIP="~your-ship"
export URBIT_CODE="sampel-ticlyt-migfun-falmel"
```

**OpenClaw:** If configured with a Tlon channel, credentials load automatically.

**Resolution order:** CLI flags → `TLON_CONFIG_FILE` → `TLON_SHIP`+`TLON_SKILL_DIR` → `URBIT_*` env vars → OpenClaw config

## Multi-Ship Usage

If you have credentials for multiple ships, you can use this skill to operate on behalf of any of them. This is useful for:

- **Managing multiple identities** — switch between ships without changing environment variables
- **Bot operations** — act as a bot ship while authenticated as yourself
- **Moon management** — operate moons from their parent planet

Simply pass the target ship's credentials via CLI flags:

```bash
# Post to a channel as ~other-ship
tlon --url https://other-ship.tlon.network --ship ~other-ship --code their-access-code \
  posts send chat/~host/channel "Hello from other-ship"

# Or keep credentials in config files
tlon --config ~/ships/bot.json channels groups
tlon --config ~/ships/moon.json contacts self
```

## Commands

### Activity

Check recent notifications and unread counts.

```bash
tlon activity mentions --limit 10   # Recent mentions (max 25)
tlon activity replies --limit 10    # Recent replies (max 25)
tlon activity all --limit 10        # All recent activity (max 25)
tlon activity unreads               # Unread counts per channel
```

### Channels

List and manage channels.

```bash
tlon channels dms                                          # List DM contacts
tlon channels group-dms                                    # List group DMs (clubs)
tlon channels groups                                       # List subscribed groups
tlon channels all                                          # List everything
tlon channels info chat/~host/slug                         # Get channel details
tlon channels update chat/~host/slug --title "New Title"   # Update metadata
tlon channels delete chat/~host/slug                       # Delete a channel
```

### Contacts

Manage contacts and profiles.

```bash
tlon contacts list                                   # List all contacts
tlon contacts self                                   # Get your own profile
tlon contacts get ~sampel                            # Get a contact's profile
tlon contacts sync ~ship1 ~ship2                     # Fetch/sync profiles
tlon contacts add ~sampel                            # Add a contact
tlon contacts remove ~sampel                         # Remove a contact
tlon contacts update-profile --nickname "My Name"    # Update your profile
```

Options: `--nickname`, `--bio`, `--status`, `--avatar`, `--cover`

### Groups

Full group management.

```bash
# Basics
tlon groups list                                         # List your groups
tlon groups info ~host/slug                              # Get group details
tlon groups create "Name" [--description "..."]          # Create a group
tlon groups join ~host/slug                              # Join a group
tlon groups leave ~host/slug                             # Leave a group
tlon groups delete ~host/slug                            # Delete (host only)
tlon groups update ~host/slug --title "..." [--description "..."]

# Members
tlon groups invite ~host/slug ~ship1 ~ship2              # Invite members
tlon groups kick ~host/slug ~ship1                       # Kick members
tlon groups ban ~host/slug ~ship1                        # Ban members
tlon groups unban ~host/slug ~ship1                      # Unban members
tlon groups accept-join ~host/slug ~ship1                # Accept join request
tlon groups reject-join ~host/slug ~ship1                # Reject join request
tlon groups set-privacy ~host/slug public|private|secret # Set privacy

# Roles
tlon groups add-role ~host/slug role-id --title "..."    # Create a role
tlon groups delete-role ~host/slug role-id               # Delete a role
tlon groups update-role ~host/slug role-id --title "..." # Update a role
tlon groups assign-role ~host/slug role-id ~ship1        # Assign role
tlon groups remove-role ~host/slug role-id ~ship1        # Remove role

# Channels
tlon groups add-channel ~host/slug "Name" [--kind chat|diary|heap]
```

Group format: `~host-ship/group-slug`

### Messages

Read and search message history.

```bash
tlon messages dm ~sampel --limit 20                      # DM history (max 50)
tlon messages channel chat/~host/slug --limit 20         # Channel history (max 50)
tlon messages search "query" --channel chat/~host/slug   # Search messages
```

Options: `--limit N`, `--resolve-cites`

### DMs

Manage direct messages.

```bash
# Group DMs (clubs)
tlon dms send <club-id> "hello"                          # Send to group DM
tlon dms reply <club-id> ~author/170.141... "reply"      # Reply in group DM

# Management
tlon dms react ~sampel ~author/170.141... "👍"           # React to a DM
tlon dms unreact ~sampel ~author/170.141...              # Remove reaction
tlon dms delete ~sampel ~author/170.141...               # Delete a DM
tlon dms accept ~sampel                                  # Accept DM invite
tlon dms decline ~sampel                                 # Decline DM invite
```

### Posts

Manage channel posts.

```bash
tlon posts react chat/~host/slug 170.141... "👍"         # React to a post
tlon posts unreact chat/~host/slug 170.141...            # Remove reaction
tlon posts delete chat/~host/slug 170.141...             # Delete a post
```

### Notebook

Post to diary/notebook channels.

```bash
tlon notebook diary/~host/slug "Title"                   # Post with no body
tlon notebook diary/~host/slug "Title" --content file.md # Post from file
tlon notebook diary/~host/slug "Title" --image <url>     # Post with image
```

### Upload

Upload images to Tlon storage.

```bash
tlon upload https://example.com/image.png    # Upload image from URL
```

Returns the uploaded image URL for use in posts, profiles, etc.

### Settings (OpenClaw)

Manage OpenClaw's Tlon plugin config via Urbit settings-store. Changes apply immediately without gateway restart.

```bash
tlon settings get                                        # Show all settings
tlon settings set <key> <json-value>                     # Set a value
tlon settings delete <key>                               # Delete a setting

# DM allowlist
tlon settings allow-dm ~ship                             # Add to DM allowlist
tlon settings remove-dm ~ship                            # Remove from allowlist

# Channel controls
tlon settings allow-channel chat/~host/slug              # Add to watch list
tlon settings remove-channel chat/~host/slug             # Remove from watch list
tlon settings open-channel chat/~host/slug               # Set channel to open
tlon settings restrict-channel chat/~host/slug [~ship1]  # Set restricted

# Authorization
tlon settings authorize-ship ~ship                       # Add to default auth
tlon settings deauthorize-ship ~ship                     # Remove from auth
```

## Notes

- Ship names should include `~` prefix
- Post IDs are @ud format with dots (e.g. `170.141.184.507...`)
- DM post IDs include author prefix (`~ship/170.141...`)
- Channel nests: `<kind>/~<host>/<name>` (chat, diary, or heap)

## Limits

- Activity: max 25 items
- Messages: max 50 items
