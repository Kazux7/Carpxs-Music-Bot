const {
  AudioPlayerStatus,
  StreamType,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel
} = require("@discordjs/voice");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const play = require("play-dl");
const ffmpegPath = require("ffmpeg-static");
const YTDlpWrap = require("yt-dlp-wrap").default;
const { getGuildLanguage, t } = require("../i18n");

class GuildMusicPlayer {
  constructor(guildId, spotifyService, options = {}) {
    this.guildId = guildId;
    this.spotifyService = spotifyService;
    this.youtubeCookie = String(options.youtubeCookie || "").trim();
    this.youtubeCookiesFile = String(options.youtubeCookiesFile || "").trim();
    this.queue = [];
    this.current = null;
    this.history = [];
    this.loopMode = "off";
    this.volume = 80;
    this.connection = null;
    this.textChannel = null;
    this.ytDlpBinaryPath = GuildMusicPlayer.resolveYtDlpBinaryPath();
    this.ytDlp = null;
    this.ensureYtDlpPromise = null;
    this.activeTranscoder = null;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    this.player.on(AudioPlayerStatus.Idle, async () => {
      this.cleanupTranscoder();
      if (this.current) {
        this.history.push(this.current);
        if (this.history.length > 50) {
          this.history.shift();
        }
        if (this.loopMode === "track") {
          this.queue.unshift(this.current);
        } else if (this.loopMode === "queue") {
          this.queue.push(this.current);
        }
      }
      this.current = null;
      await this.playNext();
    });

    this.player.on("error", async (error) => {
      if (this.textChannel) {
        const lang = getGuildLanguage(this.guildId);
        await this.textChannel.send(`${t(lang, "playbackError")}: ${error.message}`);
      }
      this.cleanupTranscoder();
      this.current = null;
      await this.playNext();
    });
  }

  static resolveYtDlpBinaryPath() {
    const fileName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    return path.resolve(process.cwd(), ".bin", fileName);
  }

  cleanupTranscoder() {
    if (!this.activeTranscoder) {
      return;
    }

    if (!this.activeTranscoder.killed) {
      this.activeTranscoder.kill("SIGKILL");
    }
    this.activeTranscoder = null;
  }

  async ensureYtDlpBinary() {
    if (fs.existsSync(this.ytDlpBinaryPath)) {
      return;
    }

    if (!this.ensureYtDlpPromise) {
      this.ensureYtDlpPromise = (async () => {
        fs.mkdirSync(path.dirname(this.ytDlpBinaryPath), { recursive: true });
        await YTDlpWrap.downloadFromGithub(this.ytDlpBinaryPath);
      })();
    }

    await this.ensureYtDlpPromise;
  }

  async getYtDlp() {
    await this.ensureYtDlpBinary();
    if (!this.ytDlp) {
      this.ytDlp = new YTDlpWrap(this.ytDlpBinaryPath);
    }
    return this.ytDlp;
  }

  setTextChannel(channel) {
    this.textChannel = channel;
  }

  async connect(voiceChannel) {
    if (
      this.connection &&
      this.connection.joinConfig.channelId === voiceChannel.id
    ) {
      return;
    }

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    this.connection.subscribe(this.player);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch {
        this.destroy();
      }
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
  }

  enqueue(track) {
    this.queue.push(track);
  }

  getQueue() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
  }

  shuffleQueue() {
    for (let i = this.queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.queue[i];
      this.queue[i] = this.queue[j];
      this.queue[j] = tmp;
    }
  }

  removeAt(position1Based) {
    const index = Number(position1Based) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= this.queue.length) {
      return null;
    }
    const [removed] = this.queue.splice(index, 1);
    return removed || null;
  }

  setLoopMode(mode) {
    const normalized = String(mode || "off").toLowerCase();
    if (!["off", "track", "queue"].includes(normalized)) {
      return this.loopMode;
    }
    this.loopMode = normalized;
    return this.loopMode;
  }

  getLoopMode() {
    return this.loopMode;
  }

  setVolume(percent) {
    const safe = Math.max(0, Math.min(200, Number(percent || 80)));
    this.volume = safe;

    const resource = this.player.state?.resource;
    if (resource?.volume) {
      resource.volume.setVolume(safe / 100);
    }

    return safe;
  }

  getVolume() {
    return this.volume;
  }

  nowPlaying() {
    return this.current;
  }

  getHistory() {
    return [...this.history];
  }

  playPrevious() {
    if (!this.history.length) {
      return null;
    }

    const previousTrack = this.history.pop();
    if (this.current) {
      this.queue.unshift(this.current);
    }
    this.queue.unshift(previousTrack);
    this.cleanupTranscoder();
    this.player.stop();
    return previousTrack;
  }

  jumpTo(position1Based) {
    const index = Number(position1Based) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= this.queue.length) {
      return null;
    }

    const [target] = this.queue.splice(index, 1);
    this.queue.unshift(target);
    this.cleanupTranscoder();
    this.player.stop();
    return target;
  }

  moveTrack(from1Based, to1Based) {
    const from = Number(from1Based) - 1;
    const to = Number(to1Based) - 1;
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= this.queue.length ||
      to >= this.queue.length
    ) {
      return false;
    }

    if (from === to) {
      return true;
    }

    const [track] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, track);
    return true;
  }

  swapTracks(a1Based, b1Based) {
    const a = Number(a1Based) - 1;
    const b = Number(b1Based) - 1;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= this.queue.length ||
      b >= this.queue.length
    ) {
      return false;
    }

    if (a === b) {
      return true;
    }

    const tmp = this.queue[a];
    this.queue[a] = this.queue[b];
    this.queue[b] = tmp;
    return true;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      historyLength: this.history.length,
      currentTitle: this.current?.title || null,
      loopMode: this.loopMode,
      volume: this.volume
    };
  }

  static buildYouTubeWatchUrl(videoId) {
    const id = String(videoId || "").trim();
    if (!id) {
      return null;
    }
    return `https://www.youtube.com/watch?v=${id}`;
  }

  static isValidHttpUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  static resolvePlayableYouTubeUrl(data) {
    if (!data) {
      return null;
    }

    const candidates = [
      data.url,
      data.webpage_url,
      data.video_url,
      data.video_details?.url,
      GuildMusicPlayer.buildYouTubeWatchUrl(data.id),
      GuildMusicPlayer.buildYouTubeWatchUrl(data.videoId),
      GuildMusicPlayer.buildYouTubeWatchUrl(data.video_details?.id)
    ];

    return candidates.find((candidate) => GuildMusicPlayer.isValidHttpUrl(candidate)) || null;
  }

  static buildCandidateUrlsFromSearchResults(results) {
    const output = [];
    const seen = new Set();

    for (const item of results || []) {
      const url = GuildMusicPlayer.resolvePlayableYouTubeUrl(item);
      if (!url || seen.has(url)) {
        continue;
      }
      seen.add(url);
      output.push(url);
    }

    return output;
  }

  getYtDlpOptionSets() {
    const options = [[]];
    options.push(["--cookies-from-browser", "chrome"]);

    if (this.youtubeCookiesFile) {
      const resolvedPath = path.isAbsolute(this.youtubeCookiesFile)
        ? this.youtubeCookiesFile
        : path.resolve(process.cwd(), this.youtubeCookiesFile);
      options.push(["--cookies", resolvedPath]);
    }

    if (this.youtubeCookie) {
      options.push(["--add-header", `Cookie:${this.youtubeCookie}`]);
    }

    return options;
  }

  async extractDirectAudioUrl(videoUrl) {
    const ytDlp = await this.getYtDlp();
    const baseArgs = [
      "--no-playlist",
      "--no-warnings",
      "-f",
      "bestaudio/best",
      "-g",
      videoUrl
    ];

    let lastError = null;
    for (const optionSet of this.getYtDlpOptionSets()) {
      try {
        const output = await ytDlp.execPromise([...optionSet, ...baseArgs]);
        const directUrl = String(output || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => GuildMusicPlayer.isValidHttpUrl(line));

        if (directUrl) {
          return directUrl;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Impossible d'extraire une source audio avec yt-dlp.");
  }

  async resolveTrack(query, requestedBy) {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) {
      throw new Error("Tu dois donner un titre ou un lien.");
    }

    if (play.yt_validate(cleanQuery) === "video") {
      const ytInfo = await play.video_info(cleanQuery);
      const playableUrl = GuildMusicPlayer.resolvePlayableYouTubeUrl(ytInfo.video_details);
      if (!playableUrl) {
        throw new Error("Impossible de lire cette video YouTube.");
      }

      return {
        title: ytInfo.video_details.title,
        artist: ytInfo.video_details.channel?.name || "YouTube",
        durationSec: Number(ytInfo.video_details.durationInSec || 0),
        thumbnail: ytInfo.video_details.thumbnails?.[0]?.url || null,
        streamUrl: playableUrl,
        backupStreamUrls: [playableUrl],
        sourceUrl: playableUrl,
        sourceType: "youtube",
        requestedBy
      };
    }

    const isSpotifyTrackInput = this.spotifyService?.constructor
      ? this.spotifyService.constructor.isSpotifyTrackLikeInput(cleanQuery)
      : false;

    if (isSpotifyTrackInput && this.spotifyService?.isEnabled()) {
      const spotifyTrack = await this.spotifyService.getTrackFromUrl(cleanQuery);
      if (!spotifyTrack) {
        throw new Error("Impossible de lire ce lien Spotify (track introuvable ou inaccessible).");
      }

      const ytQuery = `${spotifyTrack.title} ${spotifyTrack.artistsJoined} audio`;
      const ytResult = await play.search(ytQuery, { source: { youtube: "video" }, limit: 5 });
      if (!ytResult.length) {
        throw new Error("Aucun résultat YouTube trouvé pour ce morceau Spotify.");
      }

      const candidateUrls = GuildMusicPlayer.buildCandidateUrlsFromSearchResults(ytResult);
      const playableUrl = candidateUrls[0];
      if (!playableUrl) {
        throw new Error("Le morceau trouvé n'a pas d'URL YouTube lisible.");
      }

      return {
        title: spotifyTrack.title,
        artist: spotifyTrack.artistsJoined,
        durationSec: spotifyTrack.durationSec,
        thumbnail: spotifyTrack.thumbnail || ytResult[0].thumbnails?.[0]?.url || null,
        streamUrl: playableUrl,
        backupStreamUrls: candidateUrls,
        sourceUrl: spotifyTrack.sourceUrl,
        sourceType: "spotify",
        requestedBy
      };
    }

    if (cleanQuery.toLowerCase().startsWith("sp ") && this.spotifyService?.isEnabled()) {
      const requestedTrack = cleanQuery.slice(3).trim();
      const spotifyTrack = await this.spotifyService.searchTrack(requestedTrack);
      if (!spotifyTrack) {
        throw new Error("Aucun morceau Spotify trouvé avec cette recherche.");
      }

      const ytQuery = `${spotifyTrack.title} ${spotifyTrack.artistsJoined} audio`;
      const ytResult = await play.search(ytQuery, { source: { youtube: "video" }, limit: 5 });
      if (!ytResult.length) {
        throw new Error("Aucun résultat YouTube trouvé pour ce morceau Spotify.");
      }

      const candidateUrls = GuildMusicPlayer.buildCandidateUrlsFromSearchResults(ytResult);
      const playableUrl = candidateUrls[0];
      if (!playableUrl) {
        throw new Error("Le morceau trouvé n'a pas d'URL YouTube lisible.");
      }

      return {
        title: spotifyTrack.title,
        artist: spotifyTrack.artistsJoined,
        durationSec: spotifyTrack.durationSec,
        thumbnail: spotifyTrack.thumbnail || ytResult[0].thumbnails?.[0]?.url || null,
        streamUrl: playableUrl,
        backupStreamUrls: candidateUrls,
        sourceUrl: spotifyTrack.sourceUrl,
        sourceType: "spotify",
        requestedBy
      };
    }

    const result = await play.search(cleanQuery, {
      source: { youtube: "video" },
      limit: 5,
      language: "fr"
    });

    if (!result.length) {
      throw new Error("Aucun résultat trouvé.");
    }

    const candidateUrls = GuildMusicPlayer.buildCandidateUrlsFromSearchResults(result);
    const playableUrl = candidateUrls[0];
    if (!playableUrl) {
      throw new Error("Le résultat trouvé n'a pas d'URL YouTube lisible.");
    }

    return {
      title: result[0].title,
      artist: result[0].channel?.name || "YouTube",
      durationSec: Number(result[0].durationInSec || 0),
      thumbnail: result[0].thumbnails?.[0]?.url || null,
      streamUrl: playableUrl,
      backupStreamUrls: candidateUrls,
      sourceUrl: playableUrl,
      sourceType: "youtube",
      requestedBy
    };
  }

  async playNext() {
    if (!this.queue.length) {
      return;
    }

    const track = this.queue.shift();
    this.current = track;

    if (!GuildMusicPlayer.isValidHttpUrl(track?.streamUrl)) {
      if (this.textChannel) {
        await this.textChannel.send(`Erreur de lecture: URL invalide pour **${track?.title || "morceau inconnu"}**.`);
      }
      this.current = null;
      await this.playNext();
      return;
    }

    const candidates = Array.from(
      new Set([
        track.streamUrl,
        ...(Array.isArray(track.backupStreamUrls) ? track.backupStreamUrls : [])
      ].filter((url) => GuildMusicPlayer.isValidHttpUrl(url)))
    );

    let lastError = null;
    let started = false;
    for (const candidateUrl of candidates) {
      try {
        const directAudioUrl = await this.extractDirectAudioUrl(candidateUrl);
        this.cleanupTranscoder();

        const ffmpegArgs = [
          "-hide_banner",
          "-loglevel",
          "error",
          "-reconnect",
          "1",
          "-reconnect_streamed",
          "1",
          "-reconnect_delay_max",
          "5",
          "-i",
          directAudioUrl,
          "-analyzeduration",
          "0",
          "-f",
          "s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
          "pipe:1"
        ];

        const transcoder = spawn(ffmpegPath, ffmpegArgs, {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });

        transcoder.on("error", (error) => {
          console.error(`Erreur ffmpeg: ${error.message}`);
        });

        this.activeTranscoder = transcoder;

        const resource = createAudioResource(transcoder.stdout, {
          inputType: StreamType.Raw,
          inlineVolume: true
        });

        resource.volume?.setVolume(this.volume / 100);

        this.player.play(resource);
        started = true;
        track.streamUrl = candidateUrl;
        break;
      } catch (error) {
        lastError = error;
        console.error(`Echec source ${candidateUrl}: ${error.message}`);
      }
    }

    if (!started) {
      const rawMessage = lastError?.message || "Aucune source audio valide trouvée.";
      const message = `Aucune source audio lisible (yt-dlp/ffmpeg). Détail: ${rawMessage}`;

      console.error(`Lecture impossible pour ${track.title}: ${rawMessage}`);
      if (this.textChannel) {
        const lang = getGuildLanguage(this.guildId);
        await this.textChannel.send(`${t(lang, "playbackError")}: ${message}`);
      }
      this.current = null;
      await this.playNext();
      return;
    }

    if (this.textChannel) {
      const lang = getGuildLanguage(this.guildId);
      await this.textChannel.send(
        `${t(lang, "nowPlaying")}: **${track.title}** - ${track.artist} (${track.sourceType})`
      );
    }
  }

  async skip() {
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      this.cleanupTranscoder();
      this.player.stop();
      return true;
    }

    return false;
  }

  pause() {
    return this.player.pause();
  }

  resume() {
    return this.player.unpause();
  }

  stop() {
    this.cleanupTranscoder();
    this.queue = [];
    this.current = null;
    this.player.stop();
  }

  destroy() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }
}

module.exports = { GuildMusicPlayer };
