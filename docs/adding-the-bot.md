# Adding the Game Scheduler bot to your server

This guide is for server owners/admins who just want to **use** the bot —
no coding or technical setup required. If you're looking to run your own
copy of the bot instead, see the main [README](../README.md).

## What the bot does

- **`/lfg`** — lets someone post that they're looking for a game on a
  given day/time/location. Others click an **"I can make it"** button to
  say they're in, and the organizer clicks **"Accept game"** to confirm it
  or **"Cancel"** if it falls through.
- **`/games`** — lists every game currently looking for players, so
  nobody has to scroll back to find the original post.

## Step 1: Invite the bot to your server

You'll need the **Manage Server** permission in your Discord server to do
this (ask a server admin if you're not sure whether you have it).

1. Get the invite link from whoever runs the bot. It looks like this:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=18432&scope=bot%20applications.commands
   ```

   > **Note for whoever is sharing this doc:** replace `YOUR_CLIENT_ID` in
   > the link above with the bot's actual Application ID (from the
   > [Discord Developer Portal](https://discord.com/developers/applications)
   > → your application → **General Information** → **Application ID**)
   > before handing this guide to anyone.

2. Open the link in your browser.
3. Use the server dropdown to pick the server you want to add the bot to.
4. Click **Continue**, then **Authorize**.
5. Complete the "I'm not a robot" check if Discord asks for one.

That's it — the bot should now appear in your server's member list
(it'll show as offline until it's actually turned on, which is up to
whoever hosts it).

## Step 2: Restrict it to one channel (recommended)

By default, anyone in your server can use `/lfg` and `/games` in *any*
channel. Most servers want to keep this contained to one channel (e.g.
`#looking-for-game`). Here's how:

1. Click your server's name at the top left, then **Server Settings**.
2. In the left sidebar, click **Integrations**.
3. Find the bot in the list (it'll be under "Bots" or "Apps") and click
   on it.
4. You'll see a list of the bot's commands (`/lfg` and `/games`).
5. Click on a command, then look for a **Channels** section. Switch it
   from "All Channels" to specific channels, and pick only the one
   channel you want (e.g. `#looking-for-game`).
6. Repeat for the other command.

Once that's done, if someone tries `/lfg` or `/games` in any other
channel, Discord will tell them it's not available there — it'll only
work in the channel you picked.

> Discord occasionally reshuffles its settings menus, so the exact
> wording/location above might drift slightly over time. If you can't
> find **Integrations**, look for a similarly-named section like **Apps**
> under Server Settings.

## Troubleshooting

- **The bot shows offline, or commands don't respond.** The bot isn't
  running right now — contact whoever hosts it.
- **I don't see "Integrations" in Server Settings.** You need the
  **Manage Server** permission. Ask a server admin to either do Step 2
  for you or grant you that permission.
- **The invite link doesn't work / says unknown application.** The
  `YOUR_CLIENT_ID` placeholder in the link probably wasn't replaced with
  the real Application ID — ask whoever gave you the link to fix it.
