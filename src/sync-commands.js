const { commands } = require("./discord/commands");
const { syncCommands } = require("./discord/syncCommands");
const { token, clientId, guildId } = require("./config");

(async () => {
  try {
    const result = await syncCommands({ token, clientId, guildId, commands });
    if (result.scope === "guild") {
      console.log(`Slash commands synchronisees pour le serveur ${result.guildId}: ${result.count}`);
      return;
    }

    console.log(`Slash commands synchronisees globalement: ${result.count}`);
  } catch (error) {
    console.error(`Echec sync commands: ${error.message}`);
    process.exit(1);
  }
})();
