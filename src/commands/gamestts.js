const { SlashCommandBuilder } = require('discord.js');
const { executeGamesList } = require('../lfgShared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamestts')
    .setDescription('List everyone currently looking for a Tabletop Simulator game in this server'),

  async execute(interaction) {
    await executeGamesList(interaction, {
      mode: 'tts',
      title: '🖥️ Open Tabletop Simulator games looking for players',
      emptyMessage: 'No one is currently looking for a Tabletop Simulator game. Use `/lfgtts` to start one!',
      headingFor: game => `Game #${game.id}`,
    });
  },
};
