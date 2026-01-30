# Tlon Skill

A [Moltbot](https://github.com/moltbot/moltbot) skill for interacting with Tlon/Urbit beyond the channel plugin.

## Features

- **Activity**: View mentions, replies, and unread notifications
- **Channels**: List DMs, group DMs, and subscribed groups
- **Contacts**: List and lookup contact profiles
- **Groups**: List groups and view group details
- **Messages**: Fetch message history from channels
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
export URBIT_CODE="sampel-ticlyt-migfun-falmel"
```

### All Scripts

#### Groups

```bash
npx ts-node scripts/groups.ts list
npx ts-node scripts/groups.ts create "My Group" --description "A cool group"
npx ts-node scripts/groups.ts info ~your-ship/group-slug
npx ts-node scripts/groups.ts invite ~your-ship/group-slug ~friend1 ~friend2
npx ts-node scripts/groups.ts leave ~host-ship/group-slug
```

#### Activity

```bash
npx ts-node scripts/activity.ts mentions --limit 10
npx ts-node scripts/activity.ts replies --limit 10
npx ts-node scripts/activity.ts all --limit 10
npx ts-node scripts/activity.ts unreads
```

#### Contacts

```bash
npx ts-node scripts/contacts.ts list
npx ts-node scripts/contacts.ts self
npx ts-node scripts/contacts.ts get ~sampel-palnet
npx ts-node scripts/contacts.ts update-profile --nickname "Name" --bio "About me"
```

#### Channels

```bash
npx ts-node scripts/channels.ts dms
npx ts-node scripts/channels.ts group-dms
npx ts-node scripts/channels.ts groups
npx ts-node scripts/channels.ts all
```

#### Messages

```bash
npx ts-node scripts/messages.ts dm ~sampel-palnet --limit 20
npx ts-node scripts/messages.ts channel chat/~host/channel-slug --limit 20
```

## API Reference

See [references/urbit-api.md](references/urbit-api.md) for Urbit HTTP API details.

## License

MIT
