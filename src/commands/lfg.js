const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { buildGameEmbed, buildGameComponents } = require('../embeds');
const { resolveSchedule } = require('../parseDateTime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription("Post that you're looking for a game")
    .addStringOption(opt =>
      opt.setName('day').setDescription('e.g. 9/20, September 20, or just 20').setRequired(true))
    .addStringOption(opt =>
      opt.setName('time').setDescription('e.g. 3:00 PM, 3pm, or 1500').setRequired(true))
    .addStringOption(opt =>
      opt.setName('location').setDescription('Where (e.g. Main St Courts)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('army').setDescription("What army are you bringing? (optional)").setRequired(false))
    .addStringOption(opt =>
      opt.setName('mission')
        .setDescription('Primary mission (optional)')
        .setRequired(false)
        .addChoices(
          { name: 'Take and Hold', value: 'Take and Hold' },
          { name: 'Purge the Foe', value: 'Purge the Foe' },
          { name: 'Reconnaissance', value: 'Reconnaissance' },
          { name: 'Priority Assets', value: 'Priority Assets' },
          { name: 'Disruption', value: 'Disruption' },
        ))
    .addStringOption(opt =>
      opt.setName('note').setDescription('Anything else people should know').setRequired(false)),

  async execute(interaction) {
    const day = interaction.options.getString('day', true);
    const time = interaction.options.getString('time', true);
    const location = interaction.options.getString('location', true);
    const army = interaction.options.getString('army') || null;
    const mission = interaction.options.getString('mission') || null;
    const note = interaction.options.getString('note') || null;

    const schedule = resolveSchedule(day, time);
    if (schedule.error) {
      await interaction.reply({
        content: [
          `I couldn't understand "${day}" / "${time}" as a date and time.`,
          '',
          'Try formats like:',
          '**day**: `9/20`, `September 20`, `Sept 20 2026`, or just `20`',
          '**time**: `3:00 PM`, `3pm`, or `1500`',
        ].join('\n'),
        ephemeral: true,
      });
      return;
    }

    const game = db.createGame({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      requesterId: interaction.user.id,
      day,
      time,
      scheduledAt: Math.floor(schedule.date.getTime() / 1000),
      location,
      note,
      army,
      mission,
    });

    const embed = buildGameEmbed(game, []);
    const components = buildGameComponents(game);

    const reply = await interaction.reply({ embeds: [embed], components, fetchReply: true });
    db.setMessageId(game.id, reply.id);
  },
};
