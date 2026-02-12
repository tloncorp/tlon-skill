# Tlon Skill

A CLI tool for interacting with Tlon/Urbit APIs.

## Installation

**npm:**
```bash
npm install @tloncorp/tlon-skill
```

**Direct download (no Node required):**
```bash
# macOS ARM64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-arm64/-/tlon-skill-darwin-arm64-0.1.0.tgz | tar -xz
mv package/tlon /usr/local/bin/

# macOS x64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-x64/-/tlon-skill-darwin-x64-0.1.0.tgz | tar -xz

# Linux x64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-linux-x64/-/tlon-skill-linux-x64-0.1.0.tgz | tar -xz
```

## Configuration

**Option 1: CLI flags (highest priority)**
```bash
# Pass credentials directly
tlon --url https://your-ship.tlon.network --ship ~your-ship --code sampel-ticlyt-migfun-falmel contacts self

# Or use a config file
tlon --config ~/ships/my-ship.json contacts self
```

Config file format:
```json
{"url": "https://your-ship.tlon.network", "ship": "~your-ship", "code": "sampel-ticlyt-migfun-falmel"}
```

**Option 2: Environment variables**
```bash
export URBIT_URL="https://your-ship.tlon.network"
export URBIT_SHIP="~your-ship"
export URBIT_CODE="sampel-ticlyt-migfun-falmel"
```

**Option 3: OpenClaw config**

If you have OpenClaw configured with a Tlon channel, credentials are loaded automatically.

## Multi-Ship Usage

If you have credentials for multiple ships, you can operate on behalf of any of them by passing their credentials via CLI flags. This is useful for managing multiple identities, bot operations, or moon management:

```bash
# Act as a different ship
tlon --config ~/ships/bot.json channels groups

# Or pass credentials directly
tlon --url https://bot.tlon.network --ship ~bot-ship --code bot-code contacts self
```

## Usage

```bash
# List your groups
tlon channels groups

# Get recent mentions
tlon activity mentions --limit 10

# Fetch DM history
tlon messages dm ~sampel-palnet --limit 20

# Update your profile
tlon contacts update-profile --nickname "My Name"

# Create a group
tlon groups create "My Group" --description "A cool group"
```

## Features

- **Activity**: Mentions, replies, unreads
- **Channels**: List DMs, group DMs, subscribed groups
- **Contacts**: List, get, update profiles
- **Groups**: Create, join, invite, roles, privacy
- **Messages**: History, search
- **DMs**: Send, react, accept/decline
- **Posts**: React, delete
- **Notebook**: Post to diary channels
- **Settings**: Hot-reload plugin config via settings-store

## Documentation

See [SKILL.md](SKILL.md) for full command reference.

## For Hosted Deployments

If you're running this in a hosted/K8s environment with additional features (workspace files, settings-store, click commands), see [@tloncorp/tlonbot](https://github.com/tloncorp/tlonbot).

## License

MIT
