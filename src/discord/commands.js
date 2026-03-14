const { SlashCommandBuilder } = require("discord.js");

const commandBuilders = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Lance un morceau par titre ou lien")
    .addStringOption((option) =>
      option
        .setName("recherche")
        .setDescription("Titre, lien YouTube, lien Spotify ou 'sp <titre>'")
        .setAutocomplete(true)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Passe au morceau suivant"),
  new SlashCommandBuilder()
    .setName("previous")
    .setDescription("Relance le morceau precedent"),
  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Met la lecture en pause"),
  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Reprend la lecture"),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop et vide la file"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Affiche la file d'attente"),
  new SlashCommandBuilder()
    .setName("np")
    .setDescription("Affiche le morceau en cours"),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Déconnecte le bot du salon vocal"),
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Fait rejoindre le bot dans ton salon vocal"),
  new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Mélange la file d'attente"),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Vide la file d'attente (sans couper le morceau en cours)"),
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Supprime un morceau de la file")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position du morceau dans /queue (a partir de 1)")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("jump")
    .setDescription("Joue directement un morceau de la file")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position du morceau dans /queue (a partir de 1)")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("move")
    .setDescription("Deplace un morceau dans la file")
    .addIntegerOption((option) =>
      option
        .setName("from")
        .setDescription("Position actuelle")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName("to")
        .setDescription("Nouvelle position")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("swap")
    .setDescription("Echange deux morceaux de la file")
    .addIntegerOption((option) =>
      option
        .setName("a")
        .setDescription("Position A")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName("b")
        .setDescription("Position B")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Règle le volume du bot")
    .addIntegerOption((option) =>
      option
        .setName("pourcent")
        .setDescription("Volume entre 0 et 200")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),
  new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Mode de répétition")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("off, track, queue")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Track", value: "track" },
          { name: "Queue", value: "queue" }
        )
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche toutes les commandes musique"),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Affiche les stats du player"),
  new SlashCommandBuilder()
    .setName("language")
    .setDescription("Choisit la langue du bot")
    .addStringOption((option) =>
      option
        .setName("lang")
        .setDescription("fr ou en")
        .setRequired(true)
        .addChoices(
          { name: "Francais", value: "fr" },
          { name: "English", value: "en" }
        )
    )
];

const commands = commandBuilders.map((builder) => builder.toJSON());

module.exports = { commands };
