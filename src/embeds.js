const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const STATUS_META = {
  open: { color: 0x5865f2, title: '⚔️ Looking for a game' },
  confirmed: { color: 0x57f287, title: '✅ Game confirmed!' },
  cancelled: { color: 0xed4245, title: '🚫 Game cancelled' },
};

const MODE_LABELS = {
  in_person: 'In Person',
  tts: 'Tabletop Simulator',
};

// Only the "open" title differs by mode; confirmed/cancelled read the same.
const TTS_OPEN_TITLE = '🖥️ Looking for a Tabletop Simulator game';

// Short description of a game for follow-up messages, e.g. "Game #4 at Main
// St Courts" or "Game #5 (Tabletop Simulator)".
function gameLabel(game) {
  return game.location
    ? `Game #${game.id} at ${game.location}`
    : `Game #${game.id} (${MODE_LABELS[game.mode] || game.mode})`;
}

function buildGameEmbed(game, rsvps) {
  const meta = STATUS_META[game.status] || STATUS_META.open;
  const title = game.status === 'open' && game.mode === 'tts' ? TTS_OPEN_TITLE : meta.title;

  // <t:seconds:F> renders as a full date+time, auto-converted to each
  // viewer's own Discord timezone setting — e.g. "Saturday, September 20,
  // 2026 3:00 PM". <t:seconds:R> adds a relative "in 3 days" alongside it.
  const when = `<t:${game.scheduled_at}:F> (<t:${game.scheduled_at}:R>)`;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(title)
    .addFields({ name: 'When', value: when })
    .setFooter({ text: `Game #${game.id} • ${MODE_LABELS[game.mode] || game.mode}` })
    .setTimestamp(game.created_at);

  if (game.location) {
    embed.addFields({ name: 'Location', value: game.location, inline: true });
  }

  if (game.army) {
    embed.addFields({ name: "Requester's army", value: game.army, inline: true });
  }

  if (game.mission) {
    embed.addFields({ name: 'Primary mission', value: game.mission, inline: true });
  }

  if (game.note) {
    embed.addFields({ name: 'Note', value: game.note });
  }

  const rsvpLines = rsvps.length
    ? rsvps.map(r => r.army ? `<@${r.userId}> — ${r.army}` : `<@${r.userId}>`).join('\n')
    : '_No one yet — be the first!_';
  embed.addFields({ name: `Can make it (${rsvps.length})`, value: rsvpLines });

  embed.setDescription(`Requested by <@${game.requester_id}>`);

  return embed;
}

function buildGameComponents(game) {
  if (game.status === 'cancelled') {
    // Terminal state — nothing left to do.
    return [];
  }

  if (game.status === 'confirmed') {
    // RSVPs are locked in once confirmed — the only action left is
    // backing out if the requester or a player can't make it after all.
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cancel:${game.id}`)
        .setLabel("Can't make it — cancel game")
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
    );
    return [row];
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp:${game.id}`)
      .setLabel("I can make it")
      .setStyle(ButtonStyle.Success)
      .setEmoji('🙋'),
    new ButtonBuilder()
      .setCustomId(`accept:${game.id}`)
      .setLabel('Accept game')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`cancel:${game.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🗑️'),
  );

  return [row];
}

module.exports = { buildGameEmbed, buildGameComponents, gameLabel };
