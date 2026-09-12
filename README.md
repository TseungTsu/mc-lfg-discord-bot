<<<<<<< HEAD
# Discord Game Scheduler Bot

A Discord bot for organizing pickup games. One person posts that they're looking
for a game on a given day/time/location, others click a button to say they can
make it, and the original requester clicks a button to confirm the game is on.

## Features

- **`/lfg day time location [army] [mission] [note]`** — Posts an embed
  announcing you're looking for a game. Anyone in the channel can see it.
  - `day` and `time` accept loose, human formats (see below) and are shown
    as a proper formatted date/time, auto-converted to each viewer's own
    Discord timezone setting — no more "12 at 1000."
  - `army` is optional — what you're bringing, shown on the post.
  - `mission` is optional — a dropdown of the five primary missions (Take
    and Hold, Purge the Foe, Reconnaissance, Priority Assets, Disruption).
- **"I can make it" button** — Anyone can click this to RSVP. A small popup
  asks (optionally) what army they're bringing, then the embed updates live
  with the list of people who are in, each with their army if they gave one.
  Clicking the button again (after already being in) removes your RSVP.
- **"Accept game" button** — Only the original requester can click this. It
  locks the post as confirmed (✅) and disables further RSVPs.
- **"Cancel" button** — Only the original requester can click this to cancel
  the game (🚫).
- **`/games`** — Lists every currently open game in the server, with a jump
  link to each post, so people don't have to scroll to find them.

Games and RSVPs are stored in a local SQLite database (`games.db`), so nothing
is lost if the bot restarts.

### Accepted day/time formats

- **day**: `9/20`, `9/20/2026`, `2026-09-20`, `September 20`, `Sept 20`,
  `Sept 20 2027`, or just a bare day number like `20` (which means "the
  next time the 20th comes around" — this month if it hasn't happened yet,
  otherwise next month).
- **time**: `3:00 PM`, `3pm`, `15:00`, or military-style `1500`/`930`.

If either doesn't parse, `/lfg` replies with an error (visible only to you)
instead of posting a broken game.

## Requirements (Windows)

- **Windows 10 or 11.**
- **Node.js LTS (v22 or later)**, which includes npm. Go to
  [nodejs.org/en/download](https://nodejs.org/en/download) and make sure
  you pick the button/version labeled **LTS** — not **Current**. "Current"
  is Node's bleeding-edge release; native packages like `better-sqlite3`
  (which this bot uses) often don't have prebuilt Windows binaries for it
  yet, which makes `npm install` try to compile from source and fail with
  Visual Studio errors. LTS avoids that entirely. Run the installer with
  defaults, then open a **new** Command Prompt or PowerShell window (must
  be reopened after installing) and confirm it worked:
  ```
  node -v
  npm -v
  ```
  Both should print version numbers.
- **A terminal** — Command Prompt, PowerShell, or Windows Terminal (from
  the Microsoft Store) all work fine. PowerShell or Windows Terminal is a
  bit more pleasant, but not required.
- **A code/text editor** to fill in the `.env` file — Notepad works, but
  [VS Code](https://code.visualstudio.com/) (free) is easier to use and
  has a built-in terminal, so you can skip switching windows.
- **A Discord account** with permission to add bots to the server you
  want to test in (your own test server is easiest — see the walkthrough
  below).
- **Internet access to `discord.com` and `registry.npmjs.org`.** If
  you're on a work or school laptop with locked-down network policies,
  `npm install` may fail — try from a personal machine/network if so.
- **No admin rights or extra compiler tools needed in the normal case.**
  One of the three packages this bot uses (`better-sqlite3`) is a native
  module, but it ships prebuilt binaries for Windows, so plain `npm
  install` should just work. If it ever fails specifically on
  `better-sqlite3` with compiler errors, that means Windows couldn't find
  a prebuilt binary for your exact Node version/architecture — the fix is
  to install the **"Desktop development with C++"** workload from the
  free [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  and re-run `npm install`. This is uncommon; only do it if you actually
  hit that error.

## Setup

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and click **New Application** (top right). Give it a name (this is what
   shows up as the bot's username by default) and create it.
2. In the left sidebar, click **Bot**. Click **Reset Token**, confirm, and
   (if you have 2FA on) enter your code. The token is shown **once** — copy
   it now. If you navigate away before copying it, you'll need to click
   **Reset Token** again to see a new one. This is your `DISCORD_TOKEN`.
   Keep it secret — anyone with it can control your bot.
3. In the left sidebar, click **General Information**. Copy the
   **Application ID** field near the top — that's your `CLIENT_ID`
   (Discord uses "Application ID" and "Client ID" interchangeably).
4. Still on the **Bot** page, scroll down to **Privileged Gateway Intents**.
   Leave **Presence Intent**, **Server Members Intent**, and **Message
   Content Intent** all switched off — this bot only uses slash commands
   and buttons, so it doesn't need any of them.

### 2. Invite the bot to your server

1. In the left sidebar, click **OAuth2**, then scroll to the **URL
   Generator** section.
2. Under **Scopes**, check **bot** and **applications.commands**.
3. A **Bot Permissions** checklist will appear below — check **Send
   Messages** and **Embed Links** (that's all this bot needs).
4. Scroll to the bottom and copy the **Generated URL** — Discord builds it
   for you, no manual permission math needed.
5. Paste that URL into your browser, pick the server you want to add the
   bot to, and click **Authorize**.

### 3. Install and configure

```bash
npm install
```

Then make a copy of `.env.example` named `.env` in the same folder. In File
Explorer that's copy-paste-rename; from the terminal, use whichever of
these matches what you're using:

```powershell
copy .env.example .env      # Command Prompt or PowerShell
```
```bash
cp .env.example .env        # Git Bash / WSL
```

Edit `.env` and fill in:

- `DISCORD_TOKEN` — from step 1
- `CLIENT_ID` — from step 1
- `GUILD_ID` (optional) — your server's ID, if you want slash commands to
  show up instantly in just that server while testing. Leave blank to
  register commands globally (can take up to an hour the first time).

To get a server ID: enable Developer Mode in Discord (the gear icon for User
Settings -> Advanced -> toggle Developer Mode on), then right-click your
server's icon in the left-hand server list and click "Copy ID".

### 4. Register the slash commands

```bash
npm run deploy-commands
```

Run this again any time you change a command's options.

> **Upgrading from an earlier copy of this bot?** The database schema
> changed (added columns for the scheduled time, army, and mission).
> Delete your old `games.db` (and `games.db-wal` / `games.db-shm` if
> present) before starting the bot again — it'll recreate a fresh one
> automatically. This
> means any test games you already posted will be gone; that's expected.

### 5. Run the bot

```bash
npm start
```

You should see `Logged in as YourBotName#1234` in the console. Try `/lfg` in
your server.

## How it works, end to end

1. Someone runs `/lfg day:20 time:3:00 PM location:Main St Courts
   army:Space Marines mission:Purge the Foe`.
2. The bot posts an embed showing the formatted date/time (auto-localized
   per viewer), the requester's army and chosen mission, and three buttons:
   **I can make it**, **Accept game**, and **Cancel**.
3. Other members click **I can make it** — a small popup asks (optionally)
   what army they're bringing, then the embed's "Can make it" list updates
   in place for everyone to see, with each person's army next to their name
   if they gave one.
4. Once the requester is happy with who's in, they click **Accept game**.
   The post turns green, is marked "Game confirmed!", and the buttons are
   removed so no more changes can be made.
5. If plans fall through before that, the requester can click **Cancel**
   instead, which marks the post red and closes it out.
6. `/games` at any time shows everyone currently looking for a game across
   the server, in case someone missed the original post.

## Project structure

```
src/
  index.js              Bot entry point, wires up commands + button/modal handling
  deploy-commands.js    Registers slash commands with Discord
  db.js                 SQLite persistence (games + rsvps)
  embeds.js             Builds the embed + buttons shown for a game
  parseDateTime.js      Parses the loose day/time input into a real Date
  commands/
    lfg.js              /lfg — post a new game
    games.js            /games — list open games
  interactions/
    buttons.js          Handles RSVP (+ army modal) / Accept / Cancel clicks
```

## Customizing

- **Change who can accept/cancel**: edit the checks in
  `src/interactions/buttons.js` (currently `interaction.user.id !==
  game.requester_id`) if you want, e.g., anyone with a certain role to also
  be able to confirm a game.
- **Add a max player count**: add a `maxPlayers` option to `/lfg`, store it
  on the game row in `db.js`, and check `rsvps.length` before allowing more
  RSVPs in `buttons.js`.
- **Post to a specific channel only**: restrict where `/lfg` can be run by
  checking `interaction.channelId` in `lfg.js`, or configure it per-server.

## Troubleshooting

**`npm install` fails with `gyp ERR! find VS` / "Could not find any Visual
Studio installation" / "No prebuilt binaries found"**

This means `better-sqlite3` couldn't find a prebuilt binary for your exact
Node version and tried to compile from source, which needs Visual Studio's
C++ build tools. Two possible causes:

- You're on Node's **Current** release instead of **LTS** (check with
  `node -v` — an odd major version, or a very recently released even one,
  is usually "Current"). Fix: uninstall Node, reinstall the version
  labeled **LTS** from [nodejs.org/en/download](https://nodejs.org/en/download).
- Even on a real LTS release, this project's `package.json` pins a
  `better-sqlite3` version that's already published a matching prebuilt
  binary for your Node version (as of this writing, `^13.0.3`, which uses
  Node's N-API and isn't tied to one exact Node version the way older
  releases were). If you're on an even newer Node release than this
  project was written for, check [better-sqlite3's npm
  page](https://www.npmjs.com/package/better-sqlite3) for the latest
  version and bump the version in `package.json` if needed.

Either way, after changing Node or `package.json`, clear out the failed
install and retry:
```
rmdir /s /q node_modules
del package-lock.json
npm install
```

If it still tries to compile from source and fails, the guaranteed fix is
installing **Visual Studio Build Tools** with the **"Desktop development
with C++"** workload (free, from
[visualstudio.microsoft.com/visual-cpp-build-tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) —
roughly a 1-2GB download). That lets `node-gyp` compile the package
locally regardless of prebuilt binary availability. Restart your terminal
after installing it, then run `npm install` again.

## Notes on hosting

This runs as a long-lived Node process — it needs to stay running to receive
Discord events. For 24/7 uptime, run it on a small VPS, a Raspberry Pi, or a
host like Railway/Fly.io/Render with a persistent volume for `games.db` (or
swap in a hosted Postgres if you'd rather not deal with a volume).
=======
# mc-lfg-discord-bot
>>>>>>> 0ee8f7310244da4586577c0c5b71c59851ada6e4
