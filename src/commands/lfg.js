const { SlashCommandBuilder } = require('discord.js');
const { addLfgOptions, executeLfg } = require('../lfgShared');

module.exports = {
  data: addLfgOptions(
    new SlashCommandBuilder()
      .setName('lfg')
      .setDescription("Post that you're looking for an in-person game"),
    { includeLocation: true, requireMeridiem: false },
  ),

  async execute(interaction) {
    await executeLfg(interaction, {
      mode: 'in_person',
      requireLocation: true,
      channelEnvVar: 'LFG_CHANNEL_ID',
      wrongChannelHint: 'the in-person games channel',
    });
  },
};
