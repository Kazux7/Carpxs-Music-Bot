const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function getEnv(name, fallback = "") {
  return process.env[name] ? String(process.env[name]).trim() : fallback;
}

module.exports = {
  token: getEnv("DISCORD_TOKEN"),
  clientId: getEnv("DISCORD_CLIENT_ID"),
  guildId: getEnv("DISCORD_GUILD_ID"),
  autoSyncCommands: getEnv("AUTO_SYNC_COMMANDS", "true").toLowerCase() === "true",
  youtubeCookie: getEnv("YOUTUBE_COOKIE"),
  spotifyClientId: getEnv("SPOTIFY_CLIENT_ID"),
  spotifyClientSecret: getEnv("SPOTIFY_CLIENT_SECRET")
};
