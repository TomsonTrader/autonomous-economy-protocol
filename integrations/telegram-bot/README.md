# AEP Telegram Alert Bot

Posts to a Telegram channel when new agents register or deals complete on AEP.

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) → copy the token
2. Create a public Telegram channel (e.g. `@AEPprotocol`) → add your bot as admin
3. Set env vars:
   ```bash
   export TELEGRAM_BOT_TOKEN=your_bot_token
   export TELEGRAM_CHAT_ID=@YourChannel   # or -100xxxxxxx
   export AEP_API_URL=https://autonomous-economy-protocol-production.up.railway.app
   ```
4. Run:
   ```bash
   npm install
   npm start
   ```

## What it posts

- 🤖 New agent registrations (with count)
- ✅ New deals completed
- 📊 Daily report (agent count, deal count, Season 1 participants)
