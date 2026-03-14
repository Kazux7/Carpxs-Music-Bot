const fs = require("node:fs");
const path = require("node:path");

const SETTINGS_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "guild-settings.json");
const SUPPORTED_LANGUAGES = new Set(["fr", "en"]);

const MESSAGES = {
  fr: {
    nowPlaying: "Lecture en cours",
    playbackError: "Erreur de lecture",
    joinFirst: "Rejoins un salon vocal d'abord.",
    playUsage: "Utilisation: /play recherche:<titre | lien YouTube | lien Spotify>",
    addedToQueue: "Ajoute a la file",
    skipped: "Morceau passe.",
    previousPlayed: "Morceau precedent relance.",
    noPreviousTrack: "Aucun morceau precedent disponible.",
    nothingToSkip: "Rien a passer.",
    paused: "Lecture en pause.",
    pauseFailed: "Impossible de mettre en pause.",
    resumed: "Lecture reprise.",
    resumeFailed: "Impossible de reprendre.",
    stopped: "Lecture stoppee et file videe.",
    queueEmpty: "La file est vide.",
    noTrackPlaying: "Aucun morceau en cours.",
    disconnected: "Deconnecte du salon vocal.",
    connected: "Connecte a ton salon vocal.",
    queueTitle: "File d'attente",
    queueCurrent: "En cours",
    queueMore: "... {count} autre(s) morceau(x)",
    loopVolume: "Loop: {loop} | Volume: {volume}%",
    removed: "Supprime",
    removeInvalid: "Position invalide (utilise /queue pour voir les positions).",
    jumpedTo: "Lecture basculee sur",
    moved: "Morceau deplace: {from} -> {to}.",
    swapped: "Morceaux echanges: {a} <-> {b}.",
    moveInvalid: "Positions invalides.",
    shuffled: "File melangee ({count} morceau(x)).",
    cleared: "File videe ({count} morceau(x) supprime(s)).",
    alreadyCleared: "La file etait deja vide.",
    volumeSet: "Volume regle a {value}%.",
    loopSet: "Mode loop: {mode}.",
    statsTitle: "Stats du Player",
    statsBody: "En cours: {current}\nFile: {queue}\nHistorique: {history}\nLoop: {loop}\nVolume: {volume}%",
    helpTitle: "Commandes Musique",
    helpBody: "- /play recherche:<titre|lien>\n- /join, /leave\n- /skip, /previous, /pause, /resume, /stop\n- /queue, /np, /stats\n- /shuffle, /clear, /remove position:<n>\n- /jump position:<n>\n- /move from:<n> to:<n>\n- /swap a:<n> b:<n>\n- /volume pourcent:<0-200>\n- /loop mode:<off|track|queue>\n- /language lang:<fr|en>",
    languageUpdated: "Langue mise a jour: **Francais**.",
    languageOptionInvalid: "Langue invalide.",
    genericError: "Erreur"
  },
  en: {
    nowPlaying: "Now Playing",
    playbackError: "Playback Error",
    joinFirst: "Join a voice channel first.",
    playUsage: "Usage: /play search:<title | YouTube link | Spotify link>",
    addedToQueue: "Added to queue",
    skipped: "Track skipped.",
    previousPlayed: "Previous track restarted.",
    noPreviousTrack: "No previous track available.",
    nothingToSkip: "Nothing to skip.",
    paused: "Playback paused.",
    pauseFailed: "Unable to pause playback.",
    resumed: "Playback resumed.",
    resumeFailed: "Unable to resume playback.",
    stopped: "Playback stopped and queue cleared.",
    queueEmpty: "The queue is empty.",
    noTrackPlaying: "No track is currently playing.",
    disconnected: "Disconnected from voice channel.",
    connected: "Connected to your voice channel.",
    queueTitle: "Queue",
    queueCurrent: "Now",
    queueMore: "... {count} more track(s)",
    loopVolume: "Loop: {loop} | Volume: {volume}%",
    removed: "Removed",
    removeInvalid: "Invalid position (use /queue to see positions).",
    jumpedTo: "Jumped to",
    moved: "Track moved: {from} -> {to}.",
    swapped: "Tracks swapped: {a} <-> {b}.",
    moveInvalid: "Invalid positions.",
    shuffled: "Queue shuffled ({count} track(s)).",
    cleared: "Queue cleared ({count} track(s) removed).",
    alreadyCleared: "Queue was already empty.",
    volumeSet: "Volume set to {value}%.",
    loopSet: "Loop mode: {mode}.",
    statsTitle: "Player Stats",
    statsBody: "Now: {current}\nQueue: {queue}\nHistory: {history}\nLoop: {loop}\nVolume: {volume}%",
    helpTitle: "Music Commands",
    helpBody: "- /play search:<title|link>\n- /join, /leave\n- /skip, /previous, /pause, /resume, /stop\n- /queue, /np, /stats\n- /shuffle, /clear, /remove position:<n>\n- /jump position:<n>\n- /move from:<n> to:<n>\n- /swap a:<n> b:<n>\n- /volume percent:<0-200>\n- /loop mode:<off|track|queue>\n- /language lang:<fr|en>",
    languageUpdated: "Language updated: **English**.",
    languageOptionInvalid: "Invalid language.",
    genericError: "Error"
  }
};

function ensureSettingsFile() {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ guilds: {} }, null, 2), "utf8");
  }
}

function readSettings() {
  ensureSettingsFile();
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { guilds: {} };
    }
    if (!parsed.guilds || typeof parsed.guilds !== "object") {
      parsed.guilds = {};
    }
    return parsed;
  } catch {
    return { guilds: {} };
  }
}

function writeSettings(settings) {
  ensureSettingsFile();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

function normalizeLang(lang) {
  const value = String(lang || "fr").toLowerCase();
  return SUPPORTED_LANGUAGES.has(value) ? value : "fr";
}

function getGuildLanguage(guildId) {
  const settings = readSettings();
  const value = settings.guilds?.[guildId]?.language;
  return normalizeLang(value);
}

function setGuildLanguage(guildId, lang) {
  const settings = readSettings();
  const normalized = normalizeLang(lang);
  if (!settings.guilds[guildId]) {
    settings.guilds[guildId] = {};
  }
  settings.guilds[guildId].language = normalized;
  writeSettings(settings);
  return normalized;
}

function t(lang, key, params = {}) {
  const normalizedLang = normalizeLang(lang);
  const dict = MESSAGES[normalizedLang] || MESSAGES.fr;
  const fallback = MESSAGES.fr;
  let template = dict[key] || fallback[key] || key;

  for (const [paramKey, value] of Object.entries(params)) {
    template = template.replaceAll(`{${paramKey}}`, String(value));
  }

  return template;
}

module.exports = {
  getGuildLanguage,
  setGuildLanguage,
  t,
  normalizeLang
};
