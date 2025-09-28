// Import prompts
import { analyzePrompt, analyzeSystemPrompt } from '../../../prompts/analyze_prompt.js';
import { analyzeQuestionPrompt, analyzeQuestionSystemPrompt } from '../../../prompts/analyze_question_prompt.js';
import { qaPrompt, qaSystemPrompt } from '../../../prompts/qa_prompt.js';
import { insightsPrompt, insightsSystemPrompt } from '../../../prompts/insights_prompt.js';
import { youtubeQueryUserPrompt, youtubeQueryUserSystemPrompt, youtubeQueryTopicPrompt, youtubeQueryTopicSystemPrompt } from '../../../prompts/youtube_query_prompt.js';

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
    if (url.pathname.endsWith('/analyzer')) return analyze(env, body);
    if (url.pathname.endsWith('/search')) return search(env, body);
    if (url.pathname.endsWith('/insights')) return insights(env, body);
    if (url.pathname.endsWith('/qa')) return qa(env, body);
    if (url.pathname.endsWith('/analyze_question')) return analyzeQuestion(env, body);
    if (url.pathname.endsWith('/clear-session')) return clearSession(env, body);
    if (url.pathname.endsWith('/r2-content')) return viewR2Content(env);
    return new Response(JSON.stringify({ ok: true, message: 'ShadowSearch API' }), { headers: { ...corsHeaders(), 'content-type': 'application/json' } });
  }
};
// Reuse ingestion fetchers for on-demand sourcing

function clean(s) { return s.replace(/\n|\r/g, ' ').replace(/\s+/g, ' ').trim(); }
function hash(s) { let h = 0; for (let i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i)|0; return String(h>>>0); }

// Extract text from HTML using the working method from google_search.js
function extractText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fetch article content from URL
async function fetchArticleContent(url, source) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ShadowSearch/1.0 (+https://shadowsearch.example)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return '';
    
    const html = await res.text();
    
    // Use the working extractText function for all sources
    const extractedText = extractText(html);
    return extractedText.slice(0, 2000); // Limit to 2000 chars
    
  } catch (e) {
    console.warn('[QA] Failed to fetch content from', url, e.message);
    return '';
  }
}

async function generateYouTubeQuery(topic, pageContent, userQuery, env) {
  try {
    // If user has a specific query, prioritize that
    if (userQuery && userQuery.trim().length > 0) {
      const system = youtubeQueryUserSystemPrompt;
      const prompt = youtubeQueryUserPrompt(userQuery, topic);
      
      const { response } = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 20
      });
      
      let query = response?.response?.trim().replace(/[^\w\s]/g, '') || '';
      
      // If AI returns good keywords, use them
      if (query && query.length > 3 && query.length < 50) {
        console.log('[YouTube Query] Generated from user query:', query, 'query:', userQuery);
        return query;
      }
    }
    
    // Fallback to topic-based generation
    const system = youtubeQueryTopicSystemPrompt;
    const prompt = youtubeQueryTopicPrompt(topic, pageContent);
    
    const { response } = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 20
    });
    
    let query = response?.response?.trim().replace(/[^\w\s]/g, '') || '';
    
    // If AI returns empty or too long, use fallback keywords
    if (!query || query.length > 50) {
      const fallback = topic.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(' ')
        .filter(w => w.length > 3)
        .slice(0, 3)
        .join(' ');
      query = fallback || 'coding interview preparation';
    }
    
    console.log('[YouTube Query] Generated from topic:', query, 'from topic:', topic, 'query:', userQuery);
    return query;
  } catch (e) {
    console.warn('[YouTube Query] Error:', e?.message || e);
    // Better fallback
    const fallback = topic.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(' ')
      .filter(w => w.length > 3)
      .slice(0, 3)
      .join(' ') || 'coding interview preparation';
    return fallback;
  }
}


async function fetchYouTube(q, env) {
  try {
    console.log('[YouTube] Searching YouTube for query:', q);
    
    // Use direct YouTube search scraping instead of yt-search library
    // This approach works in Cloudflare Workers without external dependencies
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`YouTube search failed: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse YouTube search results from HTML
    const videos = parseYouTubeSearchResults(html).slice(0, 4);
    
    console.log('[YouTube] Parsed videos:', videos.length);
    return videos;
  } catch (e) { 
    console.error('[YouTube] Search Error:', e?.message || e);
    return []; 
  }
}

function parseYouTubeSearchResults(html) {
  try {
    const videos = [];
    
    // Look for video data in the page's initial data
    const initialDataMatch = html.match(/var ytInitialData = ({.+?});/);
    if (!initialDataMatch) {
      console.log('[YouTube] No initial data found');
      return videos;
    }
    
    const initialData = JSON.parse(initialDataMatch[1]);
    
    // Navigate through the YouTube data structure to find video results
    const contents = initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    
    if (!contents) {
      console.log('[YouTube] No contents found in initial data');
      return videos;
    }
    
    for (const item of contents) {
      if (item.videoRenderer) {
        const video = item.videoRenderer;
        const videoId = video.videoId;
        const title = video.title?.runs?.[0]?.text || 'Unknown Title';
        const channel = video.ownerText?.runs?.[0]?.text || 'Unknown Channel';
        const thumbnail = video.thumbnail?.thumbnails?.[0]?.url || '';
        const duration = video.lengthText?.simpleText || '';
        const views = video.viewCountText?.simpleText || '';
        const published = video.publishedTimeText?.simpleText || '';
        
        if (videoId && title !== 'Unknown Title') {
          videos.push({
            id: videoId,
            title: title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail: thumbnail,
            channel: channel,
            publishedAt: published,
            duration: duration,
            views: views
          });
        }
      }
    }
    
    console.log('[YouTube] Successfully parsed', videos.length, 'videos');
    return videos;
  } catch (e) {
    console.error('[YouTube] Parse error:', e?.message || e);
    return [];
  }
}

async function fetchGoogle(q, env, serperApiKey = null) {
  try {
    // Use Serper API instead of Google Custom Search API
    const apiKey = serperApiKey || env.SERPER_API_KEY;
    if (!apiKey) { console.warn('[QA] SERPER_API_KEY not provided'); return []; }
    
    const myHeaders = new Headers();
    myHeaders.append("X-API-KEY", apiKey);
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      "q": q
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };
    
    const res = await fetch("https://google.serper.dev/search", requestOptions);
    if (!res.ok) { console.warn('[QA] Serper API error', res.status); return []; }
    const json = await res.json();
    const items = json?.organic || [];
    return items.map((it, i) => ({ id: `g_${i}_${hash(it.link)}`, title: it.title || it.link, url: it.link, source: 'google' }));
  } catch (_) { return []; }
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { ...corsHeaders(), 'content-type': 'application/json', ...(init.headers || {}) } });
}

async function analyze(env, { title = '', url = '', text = '' }) {
  // Use Workers AI to extract topic and entities
  // Model: Llama 3.1 Instruct small for speed
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
    // Fallback heuristic if AI is unavailable
    const topic = title || firstSentence(text) || 'Unknown Topic';
    const entities = keywordGuess(text);
    console.error('[Analyzer AI error]', e?.message || e);
    return json({ topic, entities, length: text.length, note: 'AI fallback', reason: String(e?.message || 'unknown') });
  }
}

// Simple QA endpoint backed by Vectorize + LLM
async function analyzeQuestion(env, { query = '', title = '', url = '', text = '' }) {
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

async function qa(env, { query = '', topic = '', sessionId = '', serperApiKey = null }) {
  try {
    if (!query || !query.trim()) return json({ error: 'Empty query' }, { status: 400 });
    console.log('[QA] Query', query, 'Topic', topic, 'Session', sessionId);
    
    // Get fresh content from Google search
    const seed = topic || query;
    const fetched = await fetchGoogle(seed, env, serperApiKey);
    let sources = [];
    let answer = '';
    
    if (fetched.length > 0) {
      console.log('[QA] Fetching content for', fetched.length, 'articles...');
      
      // Process and store content in R2
      const articlesWithContent = [];
      for (const article of fetched) {
        try {
          const content = await fetchArticleContent(article.url, article.source);
          console.log('[QA] Content fetch result:', { 
            url: article.url, 
            source: article.source, 
            contentLength: content?.length || 0,
            hasContent: !!content
          });
          
          // Only include articles with actual content
          if (content && content.length > 50) {
            const contentData = {
              title: article.title,
              url: article.url,
              source: article.source,
              content: content,
              timestamp: new Date().toISOString(),
              sessionId: sessionId
            };
            
            // Store in R2 bucket
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
      
      // Use direct LLM with stored content
      if (articlesWithContent.length > 0) {
        const prompt = qaPrompt(query, articlesWithContent);
        const llm = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: qaSystemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 500
        });
        
        answer = llm?.response || llm?.text || 'I could not generate an answer based on the available sources.';
        sources = articlesWithContent.map(item => ({
          title: item.title,
          url: item.url,
          source: item.source
        }));
        
        console.log('[QA] LLM response:', answer);
      } else {
        // Fallback: use basic Google results
        answer = `I found some information about "${query}" but couldn't extract detailed content. Please try a different search or provide more context.`;
        sources = fetched.map(item => ({
          title: item.title,
          url: item.url,
          source: item.source
        }));
      }
    } else {
      // No Google results - generic answer
      answer = `I don't have specific information about "${query}". Please try a different search or provide more context.`;
      sources = [];
    }
    
    console.log('[QA] Final response:', { 
      answerLength: answer.length, 
      sourcesCount: sources.length 
    });
    
    return json({ answer, sources, insertedIds: [] });
  } catch (e) {
    console.error('[QA error]', e?.message || e);
    return json({ error: String(e?.message || e || 'unknown') }, { status: 500 });
  }
}


async function search(env, { topic = '', entities = [], pageContent = '', query = '', serperApiKey = null }) {
  const q = encodeURIComponent(topic || entities.join(' '));
  
  console.log('[Search] Received params:', { topic, entities, pageContent: pageContent?.length || 0, query });
  console.log('[Search] Topic:', topic, 'Query:', query, 'PageContent length:', pageContent?.length || 0);
  
  // Generate YouTube-friendly query based on page content + user query
  const youtubeQuery = await generateYouTubeQuery(topic, pageContent, query, env);
  console.log('[Search] Generated YouTube query:', youtubeQuery);
  
  const videos = await fetchYouTube(youtubeQuery, env);
  console.log('[Search] Fetched videos:', videos?.length || 0);
  
  return json({
    reddit: `https://www.reddit.com/search/?q=${q}`,
    hackernews: `https://hn.algolia.com/?q=${q}`,
    arxiv: `https://arxiv.org/search/?query=${q}&searchtype=all`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    videos: videos
  });
}

async function insights(env, { analyzer = {}, search = {} }) {
  const { topic = 'this page', entities = [] } = analyzer || {};
  const system = insightsSystemPrompt;
  const instruction = insightsPrompt(topic, entities);
  try {
    const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: instruction }
      ],
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
    // Fallback if AI binding not available
    console.error('[Insights AI error]', e?.message || e);
    const bullets = [
      `Topic: ${topic}`,
      entities.length ? `Key entities: ${entities.join(', ')}` : 'Few named entities detected.',
      'Workers AI not available; using fallback notes.'
    ];
    const takes = [
      'Opposing view: Automated summaries can oversimplify nuanced arguments.',
      'Consider privacy and consent when analyzing page content.'
    ];
    const videos = search?.videos || [{ title: `Videos about ${topic}`, url: search.youtube || 'https://www.youtube.com' }];
    return json({ insights: bullets, takes, videos, note: 'AI fallback', reason: String(e?.message || 'unknown') });
  }
}

function safeJson(text) {
  try { return JSON.parse(text); } catch (e) {
    // Try to extract JSON block if model wrapped text
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (_) { /* ignore */ } }
    return null;
  }
}

function firstSentence(t) {
  return (t || '').split(/[.!?]/)[0]?.trim();
}

function keywordGuess(t) {
  const words = (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const stop = new Set(['the','and','for','that','with','this','have','from','are','was','you','your','but','not','all','any','can','has','our','their','its','into','over','more','than','also','about']);
  const counts = new Map();
  for (const w of words) { if (!stop.has(w) && w.length > 3) counts.set(w, (counts.get(w) || 0) + 1); }
  return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
}

function arr(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

async function viewR2Content(env) {
  try {
    console.log('[R2Viewer] Listing R2 content...');
    const objects = await env.CONTENT_BUCKET.list();
    const contentList = [];
    
    console.log(`[R2Viewer] Found ${objects.objects.length} objects`);
    
    for (const obj of objects.objects) {
      try {
        const content = await env.CONTENT_BUCKET.get(obj.key);
        if (content) {
          const data = await content.json();
          contentList.push({
            key: obj.key,
            title: data.title,
            url: data.url,
            source: data.source,
            contentLength: data.content?.length || 0,
            timestamp: data.timestamp,
            sessionId: data.sessionId,
            contentPreview: data.content?.slice(0, 200) + '...' || 'No content'
          });
        }
      } catch (error) {
        console.log(`[R2Viewer] Error reading ${obj.key}:`, error.message);
        contentList.push({
          key: obj.key,
          error: error.message
        });
      }
    }
    
    console.log(`[R2Viewer] Successfully processed ${contentList.length} objects`);
    
    return json({ 
      count: contentList.length, 
      objects: contentList,
      message: 'R2 content retrieved successfully'
    });
  } catch (error) {
    console.error('[R2Viewer error]', error?.message || error);
    return json({ error: error.message }, { status: 500 });
  }
}

// Remove all R2 objects associated with a sessionId (prefix delete)
async function clearSession(env, { sessionId = '' }) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return json({ error: 'sessionId required' }, { status: 400 });
    }
    const prefix = `content/${sessionId}/`;
    console.log('[ClearSession] Clearing prefix:', prefix);
    const toDelete = [];
    let cursor = undefined;
    do {
      const listResp = await env.CONTENT_BUCKET.list({ prefix, cursor });
      for (const obj of listResp.objects) {
        toDelete.push(obj.key);
      }
      cursor = listResp.truncated ? listResp.cursor : undefined;
    } while (cursor);

    if (toDelete.length) {
      await Promise.allSettled(toDelete.map((key) => env.CONTENT_BUCKET.delete(key)));
    }
    console.log('[ClearSession] Deleted objects:', toDelete.length);
    return json({ ok: true, deleted: toDelete.length });
  } catch (e) {
    console.error('[ClearSession error]', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}


