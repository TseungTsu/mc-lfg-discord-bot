// Notifications about a game: who gets told, and how.
//
// Delivery is DM-first. If a DM can't be sent (user has DMs closed to server
// members, blocked the bot, ...) we fall back to a public message in the
// game's channel that @mentions them. The mention has to be in the message
// *content* — a mention inside an embed field doesn't trigger a real Discord
// notification.
//
// Lives outside src/commands/ on purpose: index.js and deploy-commands.js
// treat every .js file directly inside commands/ as a slash command.

const { gameLabel, whenText } = require('./embeds');

// "Game #4 at Main St (<t:...:F>)" — enough context to stand alone in a DM.
function describeGame(game) {
  return `${gameLabel(game)} (${whenText(game)})`;
}

function jumpLine(game) {
  if (!game.message_id) return '';
  const url = `https://discord.com/channels/${game.guild_id}/${game.channel_id}/${game.message_id}`;
  return `\n[Jump to the game post](${url})`;
}

// Notification copy. Each takes the game (plus who did it) and returns the
// message body. Worded so it reads correctly for any recipient, since the
// same text is used for the DM and for the batched channel fallback.
const messages = {
  joined: (game, actorId, army) =>
    `🙋 <@${actorId}> can make it to your ${describeGame(game)}${army ? ` — bringing ${army}` : ''}!${jumpLine(game)}`,
  backedOut: (game, actorId) =>
    `😕 <@${actorId}> backed out of your ${describeGame(game)}.${jumpLine(game)}`,
  confirmed: game =>
    `✅ ${describeGame(game)} has been confirmed!${jumpLine(game)}`,
  cancelled: (game, actorId) =>
    `🚫 ${describeGame(game)} has been cancelled by <@${actorId}>.${jumpLine(game)}`,
};

// Sends `content` to each of `userIds`, minus `actorId` (nobody is notified
// about their own action). DMs go out individually; everyone whose DM failed
// is then @mentioned together in ONE follow-up message in the channel.
//
// Never throws — the interaction has already been answered by the time this
// runs, so a failure here must not surface as "Something went wrong".
async function notifyUsers(interaction, userIds, actorId, content) {
  const recipients = [...new Set(userIds)].filter(id => id !== actorId);
  if (recipients.length === 0) return;

  const failed = [];
  for (const id of recipients) {
    try {
      const user = await interaction.client.users.fetch(id);
      await user.send({ content });
    } catch {
      failed.push(id);
    }
  }

  if (failed.length === 0) return;

  try {
    const mentions = failed.map(id => `<@${id}>`).join(' ');
    await interaction.followUp({
      content: `${mentions}\n${content}`,
      // Only ping the people we're actually notifying, not e.g. the actor
      // who is merely named in the text.
      allowedMentions: { users: failed },
    });
  } catch (err) {
    console.error('Could not send fallback notification:', err);
  }
}

module.exports = { notifyUsers, messages };
