import { json } from '../utils/cors.js';

export async function youtubeTranscriptRoute(env, { videoId = '' }) {
  try {
    if (!videoId || typeof videoId !== 'string') {
      return json({ error: 'videoId required' }, { status: 400 });
    }

    // Fetch the YouTube watch page
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
    if (!pageRes.ok) return json({ error: 'failed to load video page' }, { status: 502 });
    const html = await pageRes.text();

    // Extract INNERTUBE_API_KEY
    const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    if (!keyMatch) return json({ error: 'INNERTUBE_API_KEY not found' }, { status: 404 });
    const apiKey = keyMatch[1];

    // Fetch player data to get caption tracks
    const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20210721.00.00' } }, videoId })
    });
    if (!playerRes.ok) return json({ error: 'player API failed' }, { status: 502 });
    const player = await playerRes.json();
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || !tracks.length) return json({ error: 'no captions' }, { status: 404 });

    const transcriptUrl = tracks[0].baseUrl;
    const trRes = await fetch(transcriptUrl);
    if (!trRes.ok) return json({ error: 'transcript fetch failed' }, { status: 502 });
    const trXml = await trRes.text();

    const lines = [];
    const regex = /<text start="([^"]+)" dur="([^"]+)">([^<]+)<\/text>/g;
    for (const match of trXml.matchAll(regex)) {
      const text = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      lines.push({ text, start: parseFloat(match[1]), duration: parseFloat(match[2]) });
    }

    return json({ ok: true, lines });
  } catch (e) {
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}


