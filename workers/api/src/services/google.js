import { hash } from '../utils/text.js';

export async function fetchGoogle(q, env, serperApiKey = null) {
  try {
    const apiKey = serperApiKey || env.SERPER_API_KEY;
    if (!apiKey) { console.warn('[QA] SERPER_API_KEY not provided'); return []; }
    const myHeaders = new Headers();
    myHeaders.append('X-API-KEY', apiKey);
    myHeaders.append('Content-Type', 'application/json');
    const raw = JSON.stringify({ q });
    const requestOptions = { method: 'POST', headers: myHeaders, body: raw, redirect: 'follow' };
    const res = await fetch('https://google.serper.dev/search', requestOptions);
    if (!res.ok) { console.warn('[QA] Serper API error', res.status); return []; }
    const json = await res.json();
    const items = json?.organic || [];
    return items.map((it, i) => ({ id: `g_${i}_${hash(it.link)}`, title: it.title || it.link, url: it.link, source: 'google' }));
  } catch (_) { return []; }
}


