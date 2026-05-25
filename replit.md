# Raganork-MD

A lightweight multi-functional WhatsApp bot framework built with the Baileys library. Supports single and multi-session operation, group management, media downloading, AI chatbot integration, and social media content processing.

## Tech Stack

- **Runtime**: Node.js 20
- **WhatsApp API**: Baileys v7
- **Database**: SQLite (local) or PostgreSQL (cloud)
- **Process**: PM2
- **System deps**: FFmpeg, libwebp

## Setup

### Required Environment Variable

The bot requires a `SESSION` environment variable to connect to WhatsApp. Set it in Replit's Secrets/Environment Variables:

```
SESSION=RGNK~<your_session_string>
```

Get your session string from https://raganork.site

For multi-session:
```
SESSION=RGNK~d7a5s66,RGNK~7ad8cW
```

### Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BOT_NAME` | Raganork | Bot display name |
| `HANDLERS` | ., | Command prefixes |
| `SUDO` | (none) | Sudo user number |
| `MODE` | private | private or public |
| `DATABASE_URL` | ./bot.db | PostgreSQL URL for cloud |
| `LANGUAGE` | english | Bot language |

## Running

The bot starts automatically via the "Start application" workflow using:
```
PORT=3000 node index.js
```

The bot starts an HTTP health server at `/health`. The actual WhatsApp connection is managed by Baileys.

## User Preferences

- Install dependencies with `--legacy-peer-deps` due to jimp peer conflict with baileys
