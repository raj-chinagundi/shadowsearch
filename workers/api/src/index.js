import { corsHeaders } from './utils/cors.js';
import { analyzerRoute } from './routes/analyzer.js';
import { analyzeQuestionRoute } from './routes/analyzeQuestion.js';
import { qaRoute } from './routes/qa.js';
import { searchRoute } from './routes/search.js';
import { insightsRoute } from './routes/insights.js';
import { clearSessionRoute } from './routes/clearSession.js';
import { viewR2ContentRoute } from './routes/r2Content.js';
import { youtubeTranscriptRoute } from './routes/youtubeTranscript.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return new Response('Only POST', { status: 405, headers: corsHeaders() });
    }
    const body = await request.json().catch(() => ({}));
    if (url.pathname.endsWith('/analyzer')) return analyzerRoute(env, body);
    if (url.pathname.endsWith('/search')) return searchRoute(env, body);
    if (url.pathname.endsWith('/insights')) return insightsRoute(env, body);
    if (url.pathname.endsWith('/qa')) return qaRoute(env, body);
    if (url.pathname.endsWith('/analyze_question')) return analyzeQuestionRoute(env, body);
    if (url.pathname.endsWith('/clear-session')) return clearSessionRoute(env, body);
    if (url.pathname.endsWith('/r2-content')) return viewR2ContentRoute(env);
    if (url.pathname.endsWith('/youtube_transcript')) return youtubeTranscriptRoute(env, body);
    return new Response(JSON.stringify({ ok: true, message: 'ShadowSearch API' }), { headers: { ...corsHeaders(), 'content-type': 'application/json' } });
  }
};
