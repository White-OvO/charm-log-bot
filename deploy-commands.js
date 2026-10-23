require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./src/commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  // Guild commands update instantly; global commands can take up to an hour.
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} command(s) ${GUILD_ID ? 'to guild' : 'globally'}.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
