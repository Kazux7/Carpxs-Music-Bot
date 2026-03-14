# Carpxs Music Bot

Bot musique Discord en Node.js avec:
- Recherche directe par titre (pas besoin de lien)
- Lecture YouTube
- Support Spotify (liens Spotify + recherche Spotify forcée)
- Slash commands (/play, /skip, etc.) + sync auto/manuelle
- File d'attente, skip, pause, reprise, now playing

## 1) Prérequis

- Node.js 20+
- Un bot Discord avec l'intent Guild Voice States activé

## 2) Installation

```bash
npm install
```

Copie `.env.example` en `.env` puis remplis:

```env
DISCORD_TOKEN=ton_token_discord
DISCORD_CLIENT_ID=application_id_du_bot
DISCORD_GUILD_ID=id_serveur_pour_sync_rapide
AUTO_SYNC_COMMANDS=true
YOUTUBE_COOKIE=
YOUTUBE_COOKIES_FILE=
SPOTIFY_CLIENT_ID=ton_client_id
SPOTIFY_CLIENT_SECRET=ton_client_secret
```

`SPOTIFY_CLIENT_ID` et `SPOTIFY_CLIENT_SECRET` sont obligatoires pour les recherches Spotify.
Sans ça, le bot fonctionne quand même en recherche YouTube.

`DISCORD_GUILD_ID` est fortement recommandé: les slash commands sont synchronisées quasi instantanément sur ce serveur.
Si tu laisses vide, la sync sera globale (plus lente a apparaître).

Lecture YouTube utilise `yt-dlp` + `ffmpeg`.
Le bot tente automatiquement `--cookies-from-browser chrome` si necessaire.

Si besoin:
- `YOUTUBE_COOKIES_FILE`: chemin vers un fichier cookies au format Netscape pour yt-dlp.
- `YOUTUBE_COOKIE`: fallback ancien format (header Cookie brut).

## 3) Lancer le bot

```bash
npm start
```

## 4) Sync des slash commands

- Sync auto au démarrage: contrôlée par `AUTO_SYNC_COMMANDS` (true/false)
- Sync manuelle: 

```bash
npm run sync:commands
```

## 5) Commandes

- `/play recherche:<titre>`: recherche YouTube et lance le morceau
- `/play recherche:<lien youtube>`: lit un lien YouTube
- `/play recherche:<lien spotify>`: récupère le morceau Spotify et le joue via source audio YouTube
- `/play recherche:sp <titre>`: force une recherche Spotify, puis lecture
- `/join`: connecte le bot à ton vocal
- `/skip`: passe au morceau suivant
- `/previous`: relance le morceau precedent
- `/pause`: met en pause
- `/resume`: reprend
- `/queue`: affiche la file
- `/np`: affiche le morceau en cours
- `/stats`: affiche les stats du player
- `/shuffle`: mélange la file
- `/clear`: vide la file
- `/remove position:<n>`: supprime un morceau de la file
- `/jump position:<n>`: joue directement un morceau de la file
- `/move from:<n> to:<n>`: deplace un morceau
- `/swap a:<n> b:<n>`: echange deux morceaux
- `/volume pourcent:<0-200>`: règle le volume
- `/loop mode:<off|track|queue>`: mode répétition
- `/language lang:<fr|en>`: change la langue du bot pour le serveur
- `/stop`: stop et vide la file
- `/leave`: déconnecte le bot du vocal
- `/help`: affiche les commandes

Le bot repond en embeds et prend en charge FR/EN par serveur.

## 6) Notes importantes

- Spotify ne fournit pas de stream audio complet via son API publique pour ce type de bot.
- Le bot utilise donc Spotify pour identifier les morceaux, puis joue une source YouTube correspondante.
- Pour de meilleures performances, héberge le bot sur une machine stable (VPS/PC allumé en continu).

## 7) Depannage YouTube

Si le bot affiche "Erreur de lecture" avec un message de formats non lisibles:

1. Exporte tes cookies YouTube dans un fichier Netscape (extension navigateur type "Get cookies.txt LOCALLY").
2. Cree un fichier `youtube-cookies.txt` a la racine du projet.
3. Mets dans `.env`:

```env
YOUTUBE_COOKIES_FILE=./youtube-cookies.txt
```

4. Redemarre le bot avec `npm start`.
