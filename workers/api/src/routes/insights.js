import { insightsPrompt, insightsSystemPrompt } from '../../../../prompts/insights_prompt.js';
import { json } from '../utils/cors.js';
import { safeJson, arr } from '../utils/text.js';

export async function insightsRoute(env, { analyzer = {}, search = {} }) {
  const { topic = 'this page', entities = [] } = analyzer || {};
  const system = insightsSystemPrompt;
  const instruction = insightsPrompt(topic, entities);
  try {
    const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [ { role: 'system', content: system }, { role: 'user', content: instruction } ],
      temperature: 0.3,
      max_tokens: 400
    });
    const raw = res?.response || res?.text || '';
    console.log('[Insights AI raw]', raw);
    const parsed = safeJson(raw) || {};
    const insightsArr = arr(parsed.insights);
    const takesArr = arr(parsed.takes);
    const videos = search?.videos || [{ title: `Videos about ${topic}`, url: search.youtube || 'https://www.youtube.com' }];
    console.log('[Insights parsed]', { insights: insightsArr.length, takes: takesArr.length });
    return json({ insights: insightsArr, takes: takesArr, videos });
  } catch (e) {
    console.error('[Insights AI error]', e?.message || e);
    const bullets = [ `Topic: ${topic}`, entities.length ? `Key entities: ${entities.join(', ')}` : 'Few named entities detected.', 'Workers AI not available; using fallback notes.' ];
    const takes = [ 'Opposing view: Automated summaries can oversimplify nuanced arguments.', 'Consider privacy and consent when analyzing page content.' ];
    const videos = search?.videos || [{ title: `Videos about ${topic}`, url: search.youtube || 'https://www.youtube.com' }];
    return json({ insights: bullets, takes, videos, note: 'AI fallback', reason: String(e?.message || 'unknown') });
  }
}


