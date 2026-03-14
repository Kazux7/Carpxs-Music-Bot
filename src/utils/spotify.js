const SpotifyWebApi = require("spotify-web-api-node");

class SpotifyService {
  constructor(clientId, clientSecret) {
    this.enabled = Boolean(clientId && clientSecret);
    this.client = this.enabled
      ? new SpotifyWebApi({ clientId, clientSecret })
      : null;

    this.expiresAt = 0;
  }

  isEnabled() {
    return this.enabled;
  }

  async ensureAccessToken() {
    if (!this.enabled) {
      return false;
    }

    const now = Date.now();
    if (this.expiresAt > now + 15_000) {
      return true;
    }

    const tokenData = await this.client.clientCredentialsGrant();
    this.client.setAccessToken(tokenData.body.access_token);
    this.expiresAt = now + tokenData.body.expires_in * 1000;
    return true;
  }

  static parseSpotifyTrackId(input) {
    const text = String(input || "").trim();
    const urlMatch = text.match(/https?:\/\/(open\.)?spotify\.com\/(?:(?:intl-[a-z]{2}|[a-z]{2}(?:-[a-z]{2})?)\/)?track\/([a-zA-Z0-9]+)(?:[/?#].*)?$/i);
    if (urlMatch && urlMatch[2]) {
      return urlMatch[2];
    }

    const uriMatch = text.match(/^spotify:track:([a-zA-Z0-9]+)$/i);
    if (uriMatch && uriMatch[1]) {
      return uriMatch[1];
    }

    return null;
  }

  static isSpotifyTrackLikeInput(input) {
    const text = String(input || "").trim().toLowerCase();
    return (
      text.startsWith("spotify:track:") ||
      text.includes("open.spotify.com/track/") ||
      text.includes("open.spotify.com/intl-") ||
      text.includes("spotify.link/")
    );
  }

  static async resolveShortSpotifyUrl(url) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      return response?.url || null;
    } catch {
      return null;
    }
  }

  static async resolveTrackId(input) {
    const directId = SpotifyService.parseSpotifyTrackId(input);
    if (directId) {
      return directId;
    }

    const text = String(input || "").trim();
    if (!/https?:\/\/spotify\.link\//i.test(text)) {
      return null;
    }

    const redirected = await SpotifyService.resolveShortSpotifyUrl(text);
    if (!redirected) {
      return null;
    }

    return SpotifyService.parseSpotifyTrackId(redirected);
  }

  static canonicalTrackUrl(trackId) {
    return `https://open.spotify.com/track/${trackId}`;
  }

  static normalizeFallbackTrack(data, fallbackUrl) {
    const rawTitle = String(data?.title || "").trim();
    const author = String(data?.author_name || "").trim() || "Artiste inconnu";
    const title = rawTitle || "Titre inconnu";

    return {
      title,
      artist: author,
      artistsJoined: author,
      durationSec: 0,
      thumbnail: data?.thumbnail_url || null,
      sourceUrl: fallbackUrl
    };
  }

  static parseTrackMetadataFromHtml(html) {
    const content = String(html || "");
    if (!content) {
      return null;
    }

    const ogTitle = content.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.trim() || "";
    const titleTag = content.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "";

    let artist = "";
    if (titleTag) {
      const byMatch = titleTag.match(/-\s*song and lyrics by\s*(.+?)\s*\|\s*spotify/i);
      if (byMatch?.[1]) {
        artist = byMatch[1].trim();
      }
    }

    return {
      title: ogTitle || null,
      artist: artist || null
    };
  }

  static async fetchTrackPageMetadata(trackUrl) {
    const response = await fetch(trackUrl, {
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Track page HTTP ${response.status}`);
    }

    const html = await response.text();
    return SpotifyService.parseTrackMetadataFromHtml(html);
  }

  static mergeFallbackTrackData(baseTrack, pageMeta) {
    const title = pageMeta?.title || baseTrack.title;
    const artist = pageMeta?.artist || baseTrack.artist;

    return {
      ...baseTrack,
      title: title || "Titre inconnu",
      artist: artist || "Artiste inconnu",
      artistsJoined: artist || "Artiste inconnu"
    };
  }

  static async fetchTrackFromOEmbed(trackUrl) {
    const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`oEmbed HTTP ${response.status}`);
    }
    return response.json();
  }

  static normalizeTrack(track) {
    const artist = track.artists?.[0]?.name || "Artiste inconnu";
    const artistsJoined = (track.artists || [])
      .map((a) => a.name)
      .filter(Boolean)
      .join(", ");

    return {
      title: track.name,
      artist,
      artistsJoined: artistsJoined || artist,
      durationSec: Math.floor((track.duration_ms || 0) / 1000),
      thumbnail: track.album?.images?.[0]?.url || null,
      sourceUrl: track.external_urls?.spotify || null
    };
  }

  async getTrackFromUrl(urlOrUri) {
    const trackId = await SpotifyService.resolveTrackId(urlOrUri);
    if (!trackId) {
      return null;
    }

    const canonicalUrl = SpotifyService.canonicalTrackUrl(trackId);

    if (!this.enabled) {
      try {
        const oembedData = await SpotifyService.fetchTrackFromOEmbed(canonicalUrl);
        const baseTrack = SpotifyService.normalizeFallbackTrack(oembedData, canonicalUrl);
        try {
          const pageMeta = await SpotifyService.fetchTrackPageMetadata(canonicalUrl);
          return SpotifyService.mergeFallbackTrackData(baseTrack, pageMeta);
        } catch {
          return baseTrack;
        }
      } catch {
        return null;
      }
    }

    try {
      await this.ensureAccessToken();
      const result = await this.client.getTrack(trackId);
      return SpotifyService.normalizeTrack(result.body);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode) {
        console.warn(`Spotify API track lookup failed (${statusCode}), fallback oEmbed...`);
      }

      try {
        const oembedData = await SpotifyService.fetchTrackFromOEmbed(canonicalUrl);
        const baseTrack = SpotifyService.normalizeFallbackTrack(oembedData, canonicalUrl);
        try {
          const pageMeta = await SpotifyService.fetchTrackPageMetadata(canonicalUrl);
          return SpotifyService.mergeFallbackTrackData(baseTrack, pageMeta);
        } catch {
          return baseTrack;
        }
      } catch {
        return null;
      }
    }
  }

  async searchTrack(query) {
    if (!this.enabled) {
      return null;
    }

    try {
      await this.ensureAccessToken();
      const result = await this.client.searchTracks(query, { limit: 1, market: "FR" });
      const track = result.body?.tracks?.items?.[0];
      return track ? SpotifyService.normalizeTrack(track) : null;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode) {
        console.warn(`Spotify API search failed (${statusCode}).`);
      }
      return null;
    }
  }
}

module.exports = { SpotifyService };
