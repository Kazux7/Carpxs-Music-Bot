# Carpxs Music Bot

A complete Discord music bot built with Node.js.

Key features:
- Search and play by title (no link required)
- YouTube playback
- Spotify support (track links + forced Spotify search)
- Slash commands with auto sync
- Queue management and advanced DJ controls
- Bilingual server mode (French/English)

## 1) Requirements

- Node.js 20+
- A Discord bot with Guild Voice States intent enabled

## 2) Installation

```bash
npm install
```

npm install automatically creates .env from .env.example if missing.

Then set your environment values in .env:

```env
DISCORD_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_bot_application_id
DISCORD_GUILD_ID=your_test_server_id
AUTO_SYNC_COMMANDS=true
YOUTUBE_COOKIE=
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Notes:
- SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are recommended for full Spotify support.
- DISCORD_GUILD_ID is recommended for fast guild command updates.

YouTube playback uses yt-dlp + ffmpeg.
The bot uses cookies from your local Chrome profile automatically.

Optional fallback:
- YOUTUBE_COOKIE: raw Cookie header fallback (only if needed)

## 3) Run

```bash
npm start
```

Minimal workflow:
- npm install
- npm start

## 4) Slash Command Sync

- Auto sync on startup: controlled by AUTO_SYNC_COMMANDS
- Manual sync:

```bash
npm run sync:commands
```

## 5) Commands

- /play recherche:<title or link> - Play from title, YouTube link, or Spotify track link
- /join - Join your voice channel
- /leave - Leave voice channel
- /skip - Skip current track
- /previous - Replay previous track
- /pause - Pause playback
- /resume - Resume playback
- /stop - Stop playback and clear queue
- /queue - Show queue
- /np - Show now playing
- /stats - Show player stats
- /shuffle - Shuffle queue
- /clear - Clear queue
- /remove position:<n> - Remove queue item
- /jump position:<n> - Jump directly to queue item
- /move from:<n> to:<n> - Move queue item
- /swap a:<n> b:<n> - Swap two queue items
- /volume pourcent:<0-200> - Set volume
- /loop mode:<off|track|queue> - Set loop mode
- /language lang:<fr|en> - Set server language
- /help - Show command help

Responses are embed-based and localized per server.

## 6) Important Notes

- Spotify public API does not provide direct full audio streaming for this bot use case.
- Spotify tracks are resolved to playable YouTube sources.
- For best stability, run the bot on a machine that stays online.

## 7) YouTube Troubleshooting

If playback fails with format-related errors:

1. Make sure Chrome is installed and logged in to YouTube on this machine.
2. Retry playback (the bot uses browser cookies automatically).
3. If still blocked, set a raw cookie header in .env:

```env
YOUTUBE_COOKIE=your_full_cookie_header
```

4. Restart the bot with npm start.
