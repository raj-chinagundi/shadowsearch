import { json } from '../utils/cors.js';
import { fetchYouTube } from '../services/youtube.js';
import { youtubeQueryUserPrompt, youtubeQueryUserSystemPrompt, youtubeQueryTopicPrompt, youtubeQueryTopicSystemPrompt } from '../../../../prompts/youtube_query_prompt.js';

async function generateYouTubeQuery(topic, pageContent, userQuery, env) {
  try {
    if (userQuery && userQuery.trim().length > 0) {
      const system = youtubeQueryUserSystemPrompt;
      const prompt = youtubeQueryUserPrompt(userQuery, topic);
      const { response } = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [ { role: 'system', content: system }, { role: 'user', content: prompt } ], temperature: 0.4, max_tokens: 20 });
      let query = response?.response?.trim().replace(/[^\w\s]/g, '') || '';
      if (query && query.length > 3 && query.length < 50) { return query; }
    }
    const system = youtubeQueryTopicSystemPrompt;
    const prompt = youtubeQueryTopicPrompt(topic, pageContent);
    const { response } = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [ { role: 'system', content: system }, { role: 'user', content: prompt } ], temperature: 0.3, max_tokens: 20 });
    let query = response?.response?.trim().replace(/[^\w\s]/g, '') || '';
    if (!query || query.length > 50) {
      const fallback = topic.toLowerCase().replace(/[^\w\s]/g, ' ').split(' ').filter(w => w.length > 3).slice(0, 3).join(' ');
      query = fallback || 'coding interview preparation';
    }
    return query;
  } catch (e) {
    const fallback = topic.toLowerCase().replace(/[^\w\s]/g, ' ').split(' ').filter(w => w.length > 3).slice(0, 3).join(' ') || 'coding interview preparation';
    return fallback;
  }
}

export async function searchRoute(env, { topic = '', entities = [], pageContent = '', query = '' }) {
  const q = encodeURIComponent(topic || entities.join(' '));
  console.log('[Search] Received params:', { topic, entities, pageContent: pageContent?.length || 0, query });
  const youtubeQuery = await generateYouTubeQuery(topic, pageContent, query, env);
  const videos = await fetchYouTube(youtubeQuery, env);
  return json({
    reddit: `https://www.reddit.com/search/?q=${q}`,
    hackernews: `https://hn.algolia.com/?q=${q}`,
    arxiv: `https://arxiv.org/search/?query=${q}&searchtype=all`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    videos
  });
}


