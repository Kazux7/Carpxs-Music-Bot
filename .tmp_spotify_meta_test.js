(async () => {
  const url = 'https://open.spotify.com/track/0jQ7zQtMbKJJP8d3ommyf5';
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await r.text();
  console.log('status', r.status, 'len', html.length);
  const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
  const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
  const musicianMatches = [...html.matchAll(/<meta name="music:musician" content="([^"]+)"/gi)].map((m) => m[1]);
  console.log('og:title', ogTitleMatch ? ogTitleMatch[1] : null);
  console.log('title', titleTagMatch ? titleTagMatch[1] : null);
  console.log('musicians', musicianMatches.slice(0, 3));
})();
