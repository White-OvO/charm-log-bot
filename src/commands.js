const { SlashCommandBuilder } = require('discord.js');

const log = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Show shiny charm contribution totals for everyone');

const board = new SlashCommandBuilder()
  .setName('board')
  .setDescription('Post the live charm board in this channel (admin only)');

const editContribution = new SlashCommandBuilder()
  .setName('editcontribution')
  .setDescription("Set a user's contribution total (admin only)")
  .addUserOption((o) => o.setName('user').setDescription('User to edit').setRequired(true))
  .addStringOption((o) =>
    o.setName('amount').setDescription('New total, e.g. 250000, 250k, or 1.5m').setRequired(true)
  );

module.exports = [log.toJSON(), board.toJSON(), editContribution.toJSON()];
