// Edge Function: latest-sermon
// Returns the newest sermon video from the church YouTube channel so the
// Worship tab always shows the latest service without anyone pasting a link.
//
// Deploy:  supabase functions deploy latest-sermon --no-verify-jwt
// Test:    curl -s https://epgwwsixhgdagavnurog.supabase.co/functions/v1/latest-sermon
//
// Reads the public Atom feed (no API key). Prefers uploads whose title looks
// like a Sunday service; otherwise falls back to the newest upload.

const CHANNEL_ID = 'UCvwg_D00trsBEjWha8JkacA'; // 올랜도 주은혜교회 Sunlight Grace Church
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const SERMON_HINT = /주일\s*예배|주일예배|sunday\s*service|worship\s*service|설교|sermon/i;

interface Entry { videoId: string; title: string; published: string }

function parseFeed(xml: string): Entry[] {
  const entries: Entry[] = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const videoId = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(block)?.[1];
    const title = /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? '';
    const published = /<published>([^<]+)<\/published>/.exec(block)?.[1] ?? '';
    if (videoId) entries.push({ videoId, title: decode(title), published });
  }
  return entries;
}

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

Deno.serve(async () => {
  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0 (GraceChurchApp)' } });
    if (!res.ok) return json({ error: `feed ${res.status}` }, 502);
    const entries = parseFeed(await res.text());
    if (entries.length === 0) return json({ error: 'no entries' }, 502);

    const pick = entries.find((e) => SERMON_HINT.test(e.title)) ?? entries[0];
    return json({
      videoId: pick.videoId,
      url: `https://www.youtube.com/watch?v=${pick.videoId}`,
      title: pick.title,
      published: pick.published,
      thumbnail: `https://img.youtube.com/vi/${pick.videoId}/hqdefault.jpg`,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Let the app cache for 10 minutes so every tab open isn't a YouTube hit.
      'Cache-Control': 'public, max-age=600',
    },
  });
}
