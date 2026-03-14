const { REST, Routes } = require("discord.js");

async function syncCommands({ token, clientId, guildId, commands }) {
  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis pour sync les slash commands.");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands
    });
    return { scope: "guild", guildId, count: commands.length };
  }

  await rest.put(Routes.applicationCommands(clientId), {
    body: commands
  });
  return { scope: "global", count: commands.length };
}

module.exports = { syncCommands };
