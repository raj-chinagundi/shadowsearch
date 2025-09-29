import { qaPrompt, qaSystemPrompt } from '../../../../prompts/qa_prompt.js';
import { json } from '../utils/cors.js';
import { fetchGoogle } from '../services/google.js';
import { fetchArticleContent } from '../services/articles.js';

export async function qaRoute(env, { query = '', topic = '', sessionId = '', serperApiKey = null }) {
  try {
    if (!query || !query.trim()) return json({ error: 'Empty query' }, { status: 400 });
    console.log('[QA] Query', query, 'Topic', topic, 'Session', sessionId);
    const seed = topic || query;
    const fetched = await fetchGoogle(seed, env, serperApiKey);
    let sources = [];
    let answer = '';
    if (fetched.length > 0) {
      console.log('[QA] Fetching content for', fetched.length, 'articles...');
      const articlesWithContent = [];
      for (const article of fetched) {
        try {
          const content = await fetchArticleContent(article.url, article.source);
          console.log('[QA] Content fetch result:', { url: article.url, source: article.source, contentLength: content?.length || 0, hasContent: !!content });
          if (content && content.length > 50) {
            const contentData = { title: article.title, url: article.url, source: article.source, content, timestamp: new Date().toISOString(), sessionId };
            const key = `content/${sessionId}/${article.id}.json`;
            await env.CONTENT_BUCKET.put(key, JSON.stringify(contentData));
            articlesWithContent.push(contentData);
            console.log('[QA] ✅ Stored content in R2:', article.title);
          } else {
            console.log('[QA] ❌ Skipped article (no content):', article.title);
          }
        } catch (error) {
          console.log('[QA] ❌ Failed to fetch content for:', article.url, error.message);
        }
      }
      console.log('[QA] Successfully stored', articlesWithContent.length, 'articles in R2');
      if (articlesWithContent.length > 0) {
        const prompt = qaPrompt(query, articlesWithContent);
        const llm = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [ { role: 'system', content: qaSystemPrompt }, { role: 'user', content: prompt } ],
          temperature: 0.2,
          max_tokens: 500
        });
        answer = llm?.response || llm?.text || 'I could not generate an answer based on the available sources.';
        sources = articlesWithContent.map(item => ({ title: item.title, url: item.url, source: item.source }));
        console.log('[QA] LLM response:', answer);
      } else {
        answer = `I found some information about "${query}" but couldn't extract detailed content. Please try a different search or provide more context.`;
        sources = fetched.map(item => ({ title: item.title, url: item.url, source: item.source }));
      }
    } else {
      answer = `I don't have specific information about "${query}". Please try a different search or provide more context.`;
      sources = [];
    }
    console.log('[QA] Final response:', { answerLength: answer.length, sourcesCount: sources.length });
    return json({ answer, sources, insertedIds: [] });
  } catch (e) {
    console.error('[QA error]', e?.message || e);
    return json({ error: String(e?.message || e || 'unknown') }, { status: 500 });
  }
}


