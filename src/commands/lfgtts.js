const { SlashCommandBuilder } = require('discord.js');
const { addLfgOptions, executeLfg } = require('../lfgShared');

module.exports = {
  data: addLfgOptions(
    new SlashCommandBuilder()
      .setName('lfgtts')
      .setDescription("Post that you're looking for a Tabletop Simulator game"),
    { includeLocation: false },
  ),

  async execute(interaction) {
    await executeLfg(interaction, {
      mode: 'tts',
      requireLocation: false,
      channelEnvVar: 'LFG_TTS_CHANNEL_ID',
      wrongChannelHint: 'the Tabletop Simulator games channel',
    });
  },
};
