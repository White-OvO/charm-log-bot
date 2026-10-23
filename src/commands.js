const { SlashCommandBuilder } = require('discord.js');

const log = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Show shiny charm contribution totals for everyone');

const editContribution = new SlashCommandBuilder()
  .setName('editcontribution')
  .setDescription("Set a user's contribution total (admin only)")
  .addUserOption((o) => o.setName('user').setDescription('User to edit').setRequired(true))
  .addStringOption((o) =>
    o.setName('amount').setDescription('New total, e.g. 250000, 250k, or 1.5m').setRequired(true)
  );

module.exports = [log.toJSON(), editContribution.toJSON()];
