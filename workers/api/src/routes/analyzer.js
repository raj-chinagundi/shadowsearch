import { analyzePrompt, analyzeSystemPrompt } from '../../../../prompts/analyze_prompt.js';
import { json } from '../utils/cors.js';
import { safeJson, firstSentence, keywordGuess } from '../utils/text.js';

export async function analyzerRoute(env, { title = '', url = '', text = '' }) {
  const prompt = analyzePrompt(title, url, text);
  try {
    const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: analyzeSystemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    });
    const textOut = res?.response || res?.text || '';
    console.log('[Analyzer AI raw]', textOut);
    const parsed = safeJson(textOut) || {};
    const topic = parsed.topic || title || firstSentence(text) || 'Unknown Topic';
    const entities = Array.isArray(parsed.entities) && parsed.entities.length ? parsed.entities.slice(0, 10) : keywordGuess(text);
    console.log('[Analyzer parsed]', { topic, entitiesCount: entities.length });
    return json({ topic, entities, length: text.length });
  } catch (e) {
    const topic = title || firstSentence(text) || 'Unknown Topic';
    const entities = keywordGuess(text);
    console.error('[Analyzer AI error]', e?.message || e);
    return json({ topic, entities, length: text.length, note: 'AI fallback', reason: String(e?.message || 'unknown') });
  }
}


