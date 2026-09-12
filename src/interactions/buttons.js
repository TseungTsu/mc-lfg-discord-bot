const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../db');
const { buildGameEmbed, buildGameComponents } = require('../embeds');

async function handleButton(interaction) {
  const [action, gameIdRaw] = interaction.customId.split(':');
  const gameId = Number(gameIdRaw);
  const game = db.getGame(gameId);

  if (!game) {
    await interaction.reply({ content: 'This game no longer exists.', ephemeral: true });
    return;
  }

  switch (action) {
    case 'rsvp': {
      if (game.status !== 'open') {
        await interaction.reply({ content: 'This game is no longer open.', ephemeral: true });
        return;
      }

      if (db.hasRsvp(game.id, interaction.user.id)) {
        // Already in — clicking again backs out.
        db.removeRsvp(game.id, interaction.user.id);
        await refresh(interaction, game.id);
        return;
      }

      // Not in yet — ask (optionally) what army they're bringing before
      // adding the RSVP. The modal submission is handled below in
      // handleRsvpModalSubmit.
      const modal = new ModalBuilder()
        .setCustomId(`rsvp-modal:${game.id}`)
        .setTitle("You're in!");

      const armyInput = new TextInputBuilder()
        .setCustomId('army')
        .setLabel('What army are you bringing? (optional)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(armyInput));
      await interaction.showModal(modal);
      break;
    }

    case 'accept': {
      if (game.status !== 'open') {
        await interaction.reply({ content: 'This game is no longer open.', ephemeral: true });
        return;
      }
      if (interaction.user.id !== game.requester_id) {
        await interaction.reply({ content: 'Only the person who posted this game can accept it.', ephemeral: true });
        return;
      }
      db.setStatus(game.id, 'confirmed');
      await refresh(interaction, game.id);

      const rsvps = db.getRsvps(game.id);
      if (rsvps.length > 0) {
        const mentions = rsvps.map(r => `<@${r.userId}>`).join(' ');
        await interaction.followUp({
          content: `✅ Game #${game.id} at ${game.location} (<t:${game.scheduled_at}:F>) is confirmed! ${mentions}`,
        });
      }
      break;
    }

    case 'cancel': {
      if (game.status !== 'open' && game.status !== 'confirmed') {
        await interaction.reply({ content: 'This game is no longer open.', ephemeral: true });
        return;
      }

      const isRequester = interaction.user.id === game.requester_id;
      // Once a game is confirmed, any of the players who RSVP'd can also
      // back out on everyone's behalf if they can't make it after all.
      const canBackOutConfirmed = game.status === 'confirmed' && db.hasRsvp(game.id, interaction.user.id);

      if (!isRequester && !canBackOutConfirmed) {
        await interaction.reply({ content: 'Only the requester can cancel this game.', ephemeral: true });
        return;
      }

      const cancelledRsvps = db.getRsvps(game.id);
      db.setStatus(game.id, 'cancelled');
      await refresh(interaction, game.id);

      const notifyIds = new Set([game.requester_id, ...cancelledRsvps.map(r => r.userId)]);
      notifyIds.delete(interaction.user.id);
      if (notifyIds.size > 0) {
        const mentions = [...notifyIds].map(id => `<@${id}>`).join(' ');
        await interaction.followUp({
          content: `🚫 Game #${game.id} at ${game.location} (<t:${game.scheduled_at}:F>) has been cancelled by <@${interaction.user.id}>. ${mentions}`,
        });
      }
      break;
    }

    default:
      await interaction.reply({ content: 'Unknown action.', ephemeral: true });
  }
}

async function handleRsvpModalSubmit(interaction) {
  const [, gameIdRaw] = interaction.customId.split(':');
  const gameId = Number(gameIdRaw);
  const game = db.getGame(gameId);

  if (!game || game.status !== 'open') {
    await interaction.reply({ content: 'This game is no longer open.', ephemeral: true });
    return;
  }

  const army = interaction.fields.getTextInputValue('army').trim() || null;
  db.addRsvp(game.id, interaction.user.id, army);

  const updatedGame = db.getGame(gameId);
  const rsvps = db.getRsvps(gameId);
  const embed = buildGameEmbed(updatedGame, rsvps);
  const components = buildGameComponents(updatedGame);

  // The modal was opened from the game's message, so this submission can
  // edit that same message directly instead of needing a separate reply.
  if (interaction.isFromMessage()) {
    await interaction.update({ embeds: [embed], components });
  } else {
    await interaction.reply({ content: "You're in!", ephemeral: true });
  }
}

async function refresh(interaction, gameId) {
  const game = db.getGame(gameId);
  const rsvps = db.getRsvps(gameId);
  const embed = buildGameEmbed(game, rsvps);
  const components = buildGameComponents(game);
  await interaction.update({ embeds: [embed], components });
}

module.exports = { handleButton, handleRsvpModalSubmit };
