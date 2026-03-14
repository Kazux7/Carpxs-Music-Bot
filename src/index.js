const { Client, GatewayIntentBits, MessageFlags, EmbedBuilder } = require("discord.js");
const {
  token,
  clientId,
  guildId,
  autoSyncCommands,
  youtubeCookie,
  spotifyClientId,
  spotifyClientSecret
} = require("./config");
const { GuildMusicPlayer } = require("./bot/musicPlayer");
const { SpotifyService } = require("./utils/spotify");
const { commands } = require("./discord/commands");
const { syncCommands } = require("./discord/syncCommands");
const { getGuildLanguage, setGuildLanguage, t, normalizeLang } = require("./i18n");
const play = require("play-dl");

if (!token) {
  console.error("DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

const spotifyService = new SpotifyService(spotifyClientId, spotifyClientSecret);
const players = new Map();

function getGuildPlayer(guildId) {
  if (!players.has(guildId)) {
    players.set(
      guildId,
      new GuildMusicPlayer(guildId, spotifyService, {
        youtubeCookie
      })
    );
  }
  return players.get(guildId);
}

function formatDuration(seconds) {
  const safe = Number(seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatAutocompleteDuration(seconds) {
  const safe = Number(seconds || 0);
  if (!Number.isFinite(safe) || safe <= 0) {
    return "?:??";
  }
  return formatDuration(safe);
}

function truncateForDiscord(text, max = 100) {
  const value = String(text || "").trim();
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function getLang(guildId) {
  return getGuildLanguage(guildId);
}

function createMusicEmbed(lang, title, description, color = 0x2f3136) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function replyMusic(interaction, options) {
  const { lang, title, description, color, ephemeral } = options;
  await interaction.reply({
    embeds: [createMusicEmbed(lang, title, description, color)],
    ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {})
  });
}

async function getMemberVoiceChannel(interaction) {
  const guildMember = await interaction.guild.members.fetch(interaction.user.id);
  return guildMember.voice?.channel || null;
}

async function buildPlayAutocompleteChoices(input, lang) {
  const query = String(input || "").trim();
  if (query.length < 2) {
    return [];
  }

  const choices = [];
  const isSpotifySearch = query.toLowerCase().startsWith("sp ");

  if (isSpotifySearch && spotifyService.isEnabled()) {
    const spotifyQuery = query.slice(3).trim();
    if (spotifyQuery.length >= 2) {
      const spotifyTrack = await spotifyService.searchTrack(spotifyQuery);
      if (spotifyTrack) {
        const value = truncateForDiscord(`sp ${spotifyTrack.title} ${spotifyTrack.artistsJoined}`, 100);
        const durationTag = formatAutocompleteDuration(spotifyTrack.durationSec);
        const name = truncateForDiscord(`[${durationTag}] Spotify: ${spotifyTrack.title} - ${spotifyTrack.artistsJoined}`, 100);
        choices.push({ name, value });
      }
    }
  }

  const ytResults = await play.search(query, {
    source: { youtube: "video" },
    limit: 8,
    language: lang === "en" ? "en" : "fr"
  });

  for (const item of ytResults) {
    const durationTag = formatAutocompleteDuration(item.durationInSec);
    const title = truncateForDiscord(item.title || "Titre inconnu", 100);
    const value = truncateForDiscord(item.title || query, 100);
    if (title && value) {
      const name = truncateForDiscord(`[${durationTag}] ${title}`, 100);
      choices.push({ name, value });
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const choice of choices) {
    const key = `${choice.name}|${choice.value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniq.push(choice);
  }

  return uniq.slice(0, 25);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once("clientReady", async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  if (!spotifyService.isEnabled()) {
    console.log("Spotify désactivé (SPOTIFY_CLIENT_ID/SECRET absents).");
  }
  if (!youtubeCookie) {
    console.log("YouTube raw cookie absent: fallback browser cookies automatique active.");
  }

  if (autoSyncCommands) {
    try {
      const result = await syncCommands({ token, clientId, guildId, commands });
      if (result.scope === "guild") {
        console.log(`Slash commands synchronisées sur le serveur ${result.guildId}: ${result.count}`);
      } else {
        console.log(`Slash commands synchronisées globalement: ${result.count}`);
      }
    } catch (error) {
      console.error(`Erreur sync automatique des commandes: ${error.message}`);
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) {
    return;
  }

  if (interaction.isAutocomplete()) {
    if (interaction.commandName !== "play") {
      return;
    }

    const focused = interaction.options.getFocused(true);
    if (focused.name !== "recherche") {
      await interaction.respond([]);
      return;
    }

    try {
      const lang = getLang(interaction.guild.id);
      const suggestions = await buildPlayAutocompleteChoices(focused.value, lang);
      await interaction.respond(suggestions);
    } catch {
      await interaction.respond([]);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = interaction.commandName;
  const query = interaction.options.getString("recherche") || "";
  const lang = getLang(interaction.guild.id);

  const player = getGuildPlayer(interaction.guild.id);
  player.setTextChannel(interaction.channel);

  try {
    if (command === "play") {
      const memberChannel = await getMemberVoiceChannel(interaction);

      if (!memberChannel) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "joinFirst"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      if (!query) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "playUsage"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      await player.connect(memberChannel);
      const track = await player.resolveTrack(query, interaction.user.tag);
      player.enqueue(track);

      await interaction.reply({
        embeds: [createMusicEmbed(lang, t(lang, "addedToQueue"), `**${track.title}** - ${track.artist} (${track.sourceType})`, 0x57f287)]
      });

      if (!player.nowPlaying()) {
        await player.playNext();
      }
      return;
    }

    if (command === "skip") {
      const skipped = await player.skip();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: skipped ? t(lang, "skipped") : t(lang, "nothingToSkip"),
        color: skipped ? 0x57f287 : 0x5865f2
      });
      return;
    }

    if (command === "previous") {
      const previous = player.playPrevious();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: previous ? t(lang, "previousPlayed") : t(lang, "noPreviousTrack"),
        color: previous ? 0x57f287 : 0x5865f2
      });
      return;
    }

    if (command === "pause") {
      const paused = player.pause();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: paused ? t(lang, "paused") : t(lang, "pauseFailed"),
        color: paused ? 0x57f287 : 0xed4245
      });
      return;
    }

    if (command === "resume") {
      const resumed = player.resume();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: resumed ? t(lang, "resumed") : t(lang, "resumeFailed"),
        color: resumed ? 0x57f287 : 0xed4245
      });
      return;
    }

    if (command === "stop") {
      player.stop();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "stopped"),
        color: 0x5865f2
      });
      return;
    }

    if (command === "queue") {
      const current = player.nowPlaying();
      const queued = player.getQueue();

      if (!current && !queued.length) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "queueTitle"),
          description: t(lang, "queueEmpty"),
          color: 0x5865f2
        });
        return;
      }

      const lines = [];
      if (current) {
        lines.push(`**${t(lang, "queueCurrent")}:** ${current.title} - ${current.artist} (${formatDuration(current.durationSec)})`);
      }

      queued.slice(0, 10).forEach((item, index) => {
        lines.push(`${index + 1}. ${item.title} - ${item.artist} (${formatDuration(item.durationSec)})`);
      });

      if (queued.length > 10) {
        lines.push(t(lang, "queueMore", { count: queued.length - 10 }));
      }

      lines.push(t(lang, "loopVolume", { loop: player.getLoopMode(), volume: player.getVolume() }));

      await interaction.reply({
        embeds: [createMusicEmbed(lang, t(lang, "queueTitle"), lines.join("\n"), 0x5865f2)]
      });
      return;
    }

    if (command === "np") {
      const current = player.nowPlaying();
      if (!current) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "nowPlaying"),
          description: t(lang, "noTrackPlaying"),
          color: 0x5865f2
        });
        return;
      }

      await interaction.reply({
        embeds: [
          createMusicEmbed(
            lang,
            t(lang, "nowPlaying"),
            `**${current.title}** - ${current.artist} (${formatDuration(current.durationSec)})`,
            0x57f287
          )
        ]
      });
      return;
    }

    if (command === "leave") {
      player.destroy();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "disconnected"),
        color: 0x5865f2
      });
      return;
    }

    if (command === "join") {
      const memberChannel = await getMemberVoiceChannel(interaction);
      if (!memberChannel) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "joinFirst"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      await player.connect(memberChannel);
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "connected"),
        color: 0x57f287
      });
      return;
    }

    if (command === "shuffle") {
      const queued = player.getQueue();
      if (!queued.length) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "queueTitle"),
          description: t(lang, "queueEmpty"),
          color: 0x5865f2
        });
        return;
      }

      player.shuffleQueue();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "shuffled", { count: queued.length }),
        color: 0x57f287
      });
      return;
    }

    if (command === "clear") {
      const count = player.getQueue().length;
      player.clearQueue();
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: count ? t(lang, "cleared", { count }) : t(lang, "alreadyCleared"),
        color: 0x57f287
      });
      return;
    }

    if (command === "remove") {
      const position = interaction.options.getInteger("position", true);
      const removed = player.removeAt(position);
      if (!removed) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "removeInvalid"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      await replyMusic(interaction, {
        lang,
        title: t(lang, "removed"),
        description: `**${removed.title}** - ${removed.artist}`,
        color: 0x57f287
      });
      return;
    }

    if (command === "jump") {
      const position = interaction.options.getInteger("position", true);
      const target = player.jumpTo(position);
      if (!target) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "removeInvalid"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: `${t(lang, "jumpedTo")}: **${target.title}** - ${target.artist}`,
        color: 0x57f287
      });
      return;
    }

    if (command === "move") {
      const from = interaction.options.getInteger("from", true);
      const to = interaction.options.getInteger("to", true);
      const moved = player.moveTrack(from, to);
      if (!moved) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "moveInvalid"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "moved", { from, to }),
        color: 0x57f287
      });
      return;
    }

    if (command === "swap") {
      const a = interaction.options.getInteger("a", true);
      const b = interaction.options.getInteger("b", true);
      const swapped = player.swapTracks(a, b);
      if (!swapped) {
        await replyMusic(interaction, {
          lang,
          title: t(lang, "genericError"),
          description: t(lang, "moveInvalid"),
          color: 0xed4245,
          ephemeral: true
        });
        return;
      }

      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "swapped", { a, b }),
        color: 0x57f287
      });
      return;
    }

    if (command === "volume") {
      const percent = interaction.options.getInteger("pourcent", true);
      const applied = player.setVolume(percent);
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "volumeSet", { value: applied }),
        color: 0x57f287
      });
      return;
    }

    if (command === "loop") {
      const mode = interaction.options.getString("mode", true);
      const applied = player.setLoopMode(mode);
      await replyMusic(interaction, {
        lang,
        title: t(lang, "queueTitle"),
        description: t(lang, "loopSet", { mode: applied }),
        color: 0x57f287
      });
      return;
    }

    if (command === "help") {
      await interaction.reply({
        embeds: [createMusicEmbed(lang, t(lang, "helpTitle"), t(lang, "helpBody"), 0x5865f2)]
      });
      return;
    }

    if (command === "stats") {
      const stats = player.getStats();
      await interaction.reply({
        embeds: [
          createMusicEmbed(
            lang,
            t(lang, "statsTitle"),
            t(lang, "statsBody", {
              current: stats.currentTitle || "-",
              queue: stats.queueLength,
              history: stats.historyLength,
              loop: stats.loopMode,
              volume: stats.volume
            }),
            0x5865f2
          )
        ]
      });
      return;
    }

    if (command === "language") {
      const selected = normalizeLang(interaction.options.getString("lang", true));
      const updatedLang = setGuildLanguage(interaction.guild.id, selected);
      await replyMusic(interaction, {
        lang: updatedLang,
        title: t(updatedLang, "helpTitle"),
        description: t(updatedLang, "languageUpdated"),
        color: 0x57f287
      });
      return;
    }
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: [createMusicEmbed(lang, t(lang, "genericError"), error.message, 0xed4245)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      embeds: [createMusicEmbed(lang, t(lang, "genericError"), error.message, 0xed4245)],
      flags: MessageFlags.Ephemeral
    });
  }
});

client.login(token);
