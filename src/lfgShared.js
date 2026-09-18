// Shared option-building and execute logic for /lfg + /lfgtts and /games +
// /gamestts. Lives outside src/commands/ on purpose — index.js and
// deploy-commands.js treat every .js file directly inside commands/ as a
// slash command, so a helper module in there would break both.

const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const { buildGameEmbed, buildGameComponents } = require('./embeds');
const { resolveSchedule } = require('./parseDateTime');

const MISSION_CHOICES = [
  { name: 'Take and Hold', value: 'Take and Hold' },
  { name: 'Purge the Foe', value: 'Purge the Foe' },
  { name: 'Reconnaissance', value: 'Reconnaissance' },
  { name: 'Priority Assets', value: 'Priority Assets' },
  { name: 'Disruption', value: 'Disruption' },
];

// Adds day/time/[location]/army/mission/note options to a
// SlashCommandBuilder and returns it. Required options must come before
// optional ones, which is why location sits between time and army.
function addLfgOptions(builder, { includeLocation }) {
  builder
    .addStringOption(opt =>
      opt.setName('day').setDescription('e.g. 9/20, September 20, or just 20').setRequired(true))
    .addStringOption(opt =>
      opt.setName('time').setDescription('e.g. 3:00 PM, 3pm, or 1500').setRequired(true));

  if (includeLocation) {
    builder.addStringOption(opt =>
      opt.setName('location').setDescription('Where (e.g. Main St Courts)').setRequired(true));
  }

  return builder
    .addStringOption(opt =>
      opt.setName('army').setDescription("What army are you bringing? (optional)").setRequired(false))
    .addStringOption(opt =>
      opt.setName('mission')
        .setDescription('Primary mission (optional)')
        .setRequired(false)
        .addChoices(...MISSION_CHOICES))
    .addStringOption(opt =>
      opt.setName('note').setDescription('Anything else people should know').setRequired(false));
}

// Shared execute() body for /lfg and /lfgtts.
//   mode             - 'in_person' | 'tts', stored on the game row
//   requireLocation  - whether the command has a `location` option
//   channelEnvVar    - .env var holding the one channel this command may be
//                      used in (e.g. 'LFG_CHANNEL_ID'). Unset = any channel.
//   wrongChannelHint - human text for the "wrong channel" reply
async function executeLfg(interaction, { mode, requireLocation, channelEnvVar, wrongChannelHint }) {
  const requiredChannelId = process.env[channelEnvVar];
  if (requiredChannelId && interaction.channelId !== requiredChannelId) {
    await interaction.reply({
      content: `Please use this command in ${wrongChannelHint} (<#${requiredChannelId}>).`,
      ephemeral: true,
    });
    return;
  }

  const day = interaction.options.getString('day', true);
  const time = interaction.options.getString('time', true);
  const location = requireLocation ? interaction.options.getString('location', true) : null;
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
    mode,
  });

  const embed = buildGameEmbed(game, []);
  const components = buildGameComponents(game);

  const reply = await interaction.reply({ embeds: [embed], components, fetchReply: true });
  db.setMessageId(game.id, reply.id);
}

// Shared execute() body for /games and /gamestts — lists every open game of
// the given mode in this server.
//   headingFor - (game) => string, the field name for each game
async function executeGamesList(interaction, { mode, title, emptyMessage, headingFor }) {
  const openGames = db.listOpenGames(interaction.guildId, mode);

  if (openGames.length === 0) {
    await interaction.reply({ content: emptyMessage, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(title);

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

    embed.addFields({ name: headingFor(game), value });
  }

  await interaction.reply({ embeds: [embed] });
}

module.exports = { addLfgOptions, executeLfg, executeGamesList };
