# Tlon Skill

A [Moltbot](https://github.com/moltbot/moltbot) skill for interacting with Tlon/Urbit beyond the channel plugin.

## Features

- **Contacts**: List, get, and update contact profiles (nicknames, bios, avatars)
- **Channels**: List channels and groups you have access to
- **Profile Management**: Update your own profile fields

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
export URBIT_CODE="sampel-ticlyt-migfun-falmel"  # Your +code
```

## Usage

The skill provides CLI scripts that Moltbot can invoke:

```bash
# List all contacts
./scripts/run.sh contacts list

# Get a specific contact
./scripts/run.sh contacts get ~sampel-palnet

# Update your nickname
./scripts/run.sh contacts update --nickname "My Name"

# List channels
./scripts/run.sh channels list
```

## Complements the Tlon Plugin

This skill handles read operations and profile management. For messaging, use the [Tlon channel plugin](https://github.com/tloncorp/moltbot-tlon).

## License

MIT
