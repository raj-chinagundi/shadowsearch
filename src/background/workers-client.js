// Worker endpoints and client utilities for background service worker

export const DEFAULT_WORKERS = {
  analyzer: 'https://your-worker-name.your-username.workers.dev/analyzer',
  search: 'https://your-worker-name.your-username.workers.dev/search',
  insights: 'https://your-worker-name.your-username.workers.dev/insights',
  qa: 'https://your-worker-name.your-username.workers.dev/qa',
  analyze_question: 'https://your-worker-name.your-username.workers.dev/analyze_question',
  youtube_transcript: 'https://your-worker-name.your-username.workers.dev/youtube_transcript',
};

export function getApiBaseUrl(workersOverrides = {}) {
  const analyzerUrl = workersOverrides.analyzer || DEFAULT_WORKERS.analyzer;
  try {
    const u = new URL(analyzerUrl);
    const basePath = u.pathname.replace(/\/analyzer$/, '');
    return `${u.protocol}//${u.host}${basePath}`;
  } catch (_) {
    return analyzerUrl.replace(/\/analyzer$/, '');
  }
}

export async function callWorker(name, body) {
  const { workers = {}, serperApiKey = '' } = await chrome.storage.sync.get(['workers', 'serperApiKey']);
  const base = workers[name] || DEFAULT_WORKERS[name];
  console.log('[ShadowSearch] Calling worker', name, base);

  const requestBody = { ...body };
  if (name === 'search' && serperApiKey) {
    requestBody.serperApiKey = serperApiKey;
  }

  try {
    let res;
    if (name === 'youtube_transcript') {
      res = await fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ videoId: requestBody.videoId || '' })
      });
    } else {
      res = await fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[ShadowSearch] Worker error', name, res.status, text);
      throw new Error(`${name} worker failed: ${res.status} - ${text}`);
    }

    const json = await res.json();
    console.log('[ShadowSearch] Worker response', name, JSON.stringify(json).slice(0, 800));
    return json;
  } catch (error) {
    console.error('[ShadowSearch] Worker fetch error', name, error.message);
    throw new Error(`Failed to reach ${name} worker: ${error.message}`);
  }
}


