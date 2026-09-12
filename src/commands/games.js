const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('games')
    .setDescription('List everyone currently looking for a game in this server'),

  async execute(interaction) {
    const openGames = db.listOpenGames(interaction.guildId);

    if (openGames.length === 0) {
      await interaction.reply({ content: 'No one is currently looking for a game. Use `/lfg` to start one!', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏀 Open games looking for players');

    for (const game of openGames) {
      const rsvps = db.getRsvps(game.id);
      const link = game.message_id
        ? `https://discord.com/channels/${game.guild_id}/${game.channel_id}/${game.message_id}`
        : null;

      const value = [
        `<t:${game.scheduled_at}:F>`,
        `Requested by <@${game.requester_id}>${game.army ? ` (${game.army})` : ''}`,
        game.mission ? `Mission: ${game.mission}` : null,
        `${rsvps.length} can make it`,
        link ? `[Jump to post](${link})` : null,
      ].filter(Boolean).join('\n');

      embed.addFields({
        name: `#${game.id} — ${game.location}`,
        value,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
