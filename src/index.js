require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const db = require('./db');
const { parseAmount } = require('./amount');
const { canEditContribution } = require('./permissions');
const { isCharmTrigger } = require('./triggers');
const { buildBoard } = require('./board');

const { DISCORD_TOKEN, ADMIN_ROLE_NAMES } = process.env;
if (!DISCORD_TOKEN) {
  console.error('Set DISCORD_TOKEN in .env');
  process.exit(1);
}

const adminRoles = new Set(
  (ADMIN_ROLE_NAMES || 'capo,executive').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
);

// Only the users we name are pinged; the bot never pings @everyone or roles.
const noPings = { parse: [] };
const BOARD_KEY = 'board';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged: enable in the developer portal
  ],
});

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: noPings });
const fmt = (n) => n.toLocaleString('en-US');

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function renderBoard(updatedAt) {
  return buildBoard(db.listContributors(), db.getTotals(), { updatedAt });
}

// Edits the live board in place so everyone in the channel sees the new totals.
// If the board message was deleted, posts a fresh one and remembers it.
async function refreshBoard() {
  const saved = db.getSetting(BOARD_KEY);
  if (!saved) return;

  const content = renderBoard(Date.now());
  try {
    const channel = await client.channels.fetch(saved.channelId);
    try {
      const message = await channel.messages.fetch(saved.messageId);
      await message.edit({ content, allowedMentions: noPings });
    } catch {
      const message = await channel.send({ content, allowedMentions: noPings });
      db.setSetting(BOARD_KEY, { channelId: channel.id, messageId: message.id });
    }
  } catch (err) {
    console.error('Could not refresh the board:', err);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guildId) return;
  const roleNames = message.mentions.roles.map((role) => role.name);
  if (!isCharmTrigger(message.content, roleNames)) return;

  const userId = message.author.id;
  try {
    const result = db.logCharm(userId);
    if (!result.ok) {
      return await message.reply({
        content: `<@${userId}> is on cooldown. You can log again in ${formatRemaining(result.remainingMs)}.`,
        allowedMentions: noPings,
      });
    }

    const { contribution, charms } = result.contributor;
    await message.reply({
      content: `✨ Logged 1 shiny charm for <@${userId}> (+${fmt(db.CHARM_VALUE)}). Total: ${fmt(contribution)} · ${charms} ${charms === 1 ? 'charm' : 'charms'}.`,
      allowedMentions: noPings,
    });
    await refreshBoard();
  } catch (err) {
    console.error(err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const isAdmin = () => {
      const roleNames = interaction.member?.roles?.cache?.map((role) => role.name) ?? [];
      return canEditContribution(interaction.user.id, interaction.guild?.ownerId, roleNames, adminRoles);
    };

    switch (interaction.commandName) {
      case 'log': {
        return interaction.reply({
          content: buildBoard(db.listContributors(), db.getTotals()),
          allowedMentions: noPings,
        });
      }

      case 'board': {
        if (!isAdmin()) return interaction.reply(ephemeral('Only the server owner or the capo/executive roles can post the board.'));
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Move the board: remove the old message if it still exists.
        const old = db.getSetting(BOARD_KEY);
        if (old) {
          const oldChannel = await client.channels.fetch(old.channelId).catch(() => null);
          const oldMessage = await oldChannel?.messages.fetch(old.messageId).catch(() => null);
          await oldMessage?.delete().catch(() => null);
        }

        const message = await interaction.channel.send({ content: renderBoard(Date.now()), allowedMentions: noPings });
        db.setSetting(BOARD_KEY, { channelId: interaction.channelId, messageId: message.id });
        return interaction.editReply({ content: 'Live board posted here. It updates on every logged charm and contribution edit.' });
      }

      case 'editcontribution': {
        if (!isAdmin()) return interaction.reply(ephemeral('Only the server owner or the capo/executive roles can edit contributions.'));

        const target = interaction.options.getUser('user', true);
        const raw = interaction.options.getString('amount', true);
        const amount = parseAmount(raw);
        if (amount === null) {
          return interaction.reply(ephemeral(`Couldn't read "${raw}". Use a number like 250000, 250k, or 1.5m.`));
        }

        const { before, after } = db.setContribution(target.id, amount);
        await interaction.reply({
          content: `Contribution for <@${target.id}>: ${fmt(before)} → ${fmt(after)}.`,
          allowedMentions: noPings,
        });
        return refreshBoard();
      }

      default:
        return interaction.reply(ephemeral('Unknown command.'));
    }
  } catch (err) {
    console.error(err);
    const payload = ephemeral('Something went wrong.');
    if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
    return interaction.reply(payload);
  }
});

client.login(DISCORD_TOKEN);
