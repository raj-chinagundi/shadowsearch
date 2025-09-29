import { analyzeQuestionPrompt, analyzeQuestionSystemPrompt } from '../../../../prompts/analyze_question_prompt.js';
import { json } from '../utils/cors.js';

export async function analyzeQuestionRoute(env, { query = '', title = '', url = '', text = '' }) {
  try {
    if (!query || !query.trim()) return json({ error: 'Empty query' }, { status: 400 });
    console.log('[AnalyzeQuestion] Query:', query);
    const prompt = analyzeQuestionPrompt(title, url, text, query);
    const llm = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: analyzeQuestionSystemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    });
    const answer = llm?.response || llm?.text || 'I could not analyze the page content.';
    console.log('[AnalyzeQuestion] Answer:', answer);
    return json({ answer: answer.trim() });
  } catch (e) {
    console.error('[AnalyzeQuestion error]', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}


