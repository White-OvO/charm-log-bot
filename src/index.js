require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const db = require('./db');
const { parseAmount } = require('./amount');
const { canEditContribution } = require('./permissions');

const { DISCORD_TOKEN, ADMIN_ROLE_NAMES, TRIGGER_NAME } = process.env;
if (!DISCORD_TOKEN) {
  console.error('Set DISCORD_TOKEN in .env');
  process.exit(1);
}

const adminRoles = new Set(
  (ADMIN_ROLE_NAMES || 'capo,executive').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
);
const trigger = (TRIGGER_NAME || 'shinycharm').trim().toLowerCase();
const triggerPattern = new RegExp(`@${trigger}\\b`, 'i');

// Only the user IDs we name here are pinged; no @everyone or role pings from the bot.
const noPings = { parse: [] };

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

// Role mention named like the trigger, or literal "@shinycharm" typed in the text.
function mentionsTrigger(message) {
  if (message.mentions.roles.some((role) => role.name.toLowerCase() === trigger)) return true;
  return triggerPattern.test(message.content);
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guildId) return;
  if (!mentionsTrigger(message)) return;

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
      content: `✨ Logged 1 shiny charm for <@${userId}> (+${fmt(db.CHARM_VALUE)}). Total: ${fmt(contribution)} · ${charms} charm${charms === 1 ? '' : 's'}.`,
      allowedMentions: noPings,
    });
  } catch (err) {
    console.error(err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'log': {
        const rows = db.listContributors();
        if (!rows.length) return interaction.reply({ content: 'No charms logged yet.', allowedMentions: noPings });

        const totals = db.getTotals();
        const header = `**Shiny Charm Log**\nTotal contribution: **${fmt(totals.contribution)}** · Charms used: **${totals.charms}**\n`;
        const lines = rows.map(
          (r, i) => `${i + 1}. <@${r.user_id}> — ${fmt(r.contribution)} · ${r.charms} charm${r.charms === 1 ? '' : 's'}`
        );

        // Discord caps messages at 2000 characters; drop trailing rows if needed.
        let shown = lines.length;
        let content = header + '\n' + lines.join('\n');
        while (content.length > 1900 && shown > 0) {
          shown -= 1;
          content = header + '\n' + lines.slice(0, shown).join('\n') + `\n…and ${lines.length - shown} more`;
        }
        return interaction.reply({ content, allowedMentions: noPings });
      }

      case 'editcontribution': {
        const roleNames = interaction.member?.roles?.cache?.map((role) => role.name) ?? [];
        if (!canEditContribution(interaction.user.id, interaction.guild?.ownerId, roleNames, adminRoles)) {
          return interaction.reply(ephemeral('Only the server owner or the capo/executive roles can edit contributions.'));
        }

        const target = interaction.options.getUser('user', true);
        const raw = interaction.options.getString('amount', true);
        const amount = parseAmount(raw);
        if (amount === null) {
          return interaction.reply(ephemeral(`Couldn't read "${raw}". Use a number like 250000, 250k, or 1.5m.`));
        }

        const { before, after } = db.setContribution(target.id, amount);
        return interaction.reply({
          content: `Contribution for <@${target.id}>: ${fmt(before)} → ${fmt(after)}.`,
          allowedMentions: noPings,
        });
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
