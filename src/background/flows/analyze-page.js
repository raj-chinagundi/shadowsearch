// Analyze page flow and YouTube flow exports
import { callWorker } from '../workers-client.js';
import { getOrCreateSession } from '../sessions.js';

let lastTopic = null;
let lastTabId = null;

export function setLastTabId(tabId) { lastTabId = tabId; }
export function getLastTopic() { return lastTopic; }

export async function handleAnalysis(tabId, payload) {
  const { title, url, text, isYouTube, videoId } = payload || {};
  if (isYouTube && videoId) {
    return handleYouTubeAnalysis({ title, url, text, videoId });
  }
  try {
    const analyzer = await callWorker('analyzer', { title, url, text });
    lastTopic = analyzer?.topic || null;
    // Immediately inform UI that analysis started with detected topic (do not send videos/sources yet)
    try { if (tabId) chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_RESULT', payload: { insights: [analyzer.topic || 'Analyzing…'], qa: false } }); } catch (_) {}

    // Kick off search and insights in parallel
    const searchPromise = callWorker('search', { topic: analyzer.topic, entities: analyzer.entities, pageContent: text, query: '' })
      .then((search) => {
        try { if (tabId) chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_RESULT', payload: { videos: search?.videos || [], qa: false } }); } catch (_) {}
        return search;
      });
    const insightsPromise = callWorker('insights', { analyzer, search: {} })
      .then((insights) => {
        try { if (tabId) chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_RESULT', payload: { insights: insights.insights || [], videos: [], sources: [], qa: false } }); } catch (_) {}
        return insights;
      });

    // Start QA in parallel to append sources later
    const qaPromise = (async () => {
      try {
        console.log('[ShadowSearch] Auto QA start', analyzer.topic);
        const sessionId = getOrCreateSession(lastTabId ?? 0, false);
        const qaResp = await callWorker('qa', { query: analyzer.topic || '', topic: lastTopic, sessionId });
        try { if (tabId) chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_RESULT', payload: { insights: [], videos: [], sources: qaResp?.sources || [], qa: false } }); } catch (_) {}
        return qaResp;
      } catch (err) {
        console.warn('[ShadowSearch] Auto QA error', err?.message || err);
        return { sources: [] };
      }
    })();

    // Compose a final result for the original caller when main pieces finish
    const [insights, search, qaResp] = await Promise.allSettled([insightsPromise, searchPromise, qaPromise]);
    const insightsVal = insights.status === 'fulfilled' ? insights.value : { insights: [] };
    const searchVal = search.status === 'fulfilled' ? search.value : { videos: [] };
    const qaVal = qaResp.status === 'fulfilled' ? qaResp.value : { sources: [] };
    return { ...(insightsVal || {}), videos: searchVal.videos || [], sources: qaVal.sources || [], qa: false };
  } catch (e) {
    console.warn('Workers not reachable, using mock data:', e?.message);
    return mockInsights({ title, url, text });
  }
}

export async function handleYouTubeAnalysis({ title, url, text, videoId }) {
  try {
    console.log('[ShadowSearch] YouTube analysis for video:', videoId);
    // Use deployed transcript worker instead of local endpoints
    const tr = await callWorker('youtube_transcript', { videoId });
    const transcriptLines = Array.isArray(tr?.lines) ? tr.lines : (Array.isArray(tr) ? tr : []);
    const transcriptText = transcriptLines.length
      ? transcriptLines.map((l) => l.text).join(' ').slice(0, 5000)
      : '';
    // Reuse existing analyzer/insights on transcript text for a consistent flow
    const analyzer = await callWorker('analyzer', { title, url, text: transcriptText || text });
    const insightsResult = await callWorker('insights', { analyzer, search: {} });
    return {
      insights: insightsResult.insights || [],
      takes: insightsResult.takes || [],
      videoAnalysis: { result: analyzer.topic || 'Video transcript analyzed', educationalValue: '', targetAudience: '' },
      isYouTube: true,
      videos: [],
      sources: []
    };
  } catch (e) {
    console.error('[ShadowSearch] YouTube analysis error:', e?.message || e);
    return {
      insights: [
        `YouTube video analysis for: ${title}`,
        'Video content detected and processing initiated',
        'AI analysis may take a moment to complete'
      ],
      takes: [
        'Consider multiple perspectives on video content',
        'Verify claims with additional sources'
      ],
      videoAnalysis: {
        result: 'Video analysis in progress. This is a simulated response for demonstration.',
        educationalValue: 'Educational content detected',
        targetAudience: 'General audience'
      },
      isYouTube: true,
      videos: [],
      sources: [],
      error: e?.message || 'YouTube analysis failed'
    };
  }
}

export function mockInsights({ title, url, text }) {
  const topic = (title || url || 'this page').slice(0, 80);
  return {
    insights: [
      `Summary for ${topic}: page analyzed locally (mock).`,
      'Core idea extraction pending real Workers connection.',
      'This is a placeholder to demonstrate the UI flow.'
    ],
    takes: [
      'Critique: Ensure privacy by analyzing only on explicit user action.',
      'Consider trade-offs between speed and depth of analysis.'
    ],
    videos: [
      { title: 'What is ShadowSearch?', url: 'https://www.youtube.com/results?search_query=ai+context+overlay' },
      { title: 'Contextual AI UX patterns', url: 'https://www.youtube.com/results?search_query=contextual+ai+ux' }
    ]
  };
}


