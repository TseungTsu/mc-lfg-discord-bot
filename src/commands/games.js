const { SlashCommandBuilder } = require('discord.js');
const { executeGamesList } = require('../lfgShared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('games')
    .setDescription('List everyone currently looking for an in-person game in this server'),

  async execute(interaction) {
    await executeGamesList(interaction, {
      mode: 'in_person',
      title: '⚔️ Open in-person games looking for players',
      emptyMessage: 'No one is currently looking for an in-person game. Use `/lfg` to start one!',
      headingFor: game => `#${game.id} — ${game.location}`,
    });
  },
};
