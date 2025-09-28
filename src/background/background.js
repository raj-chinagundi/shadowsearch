// Background service worker for ShadowSearch

let lastTopic = null;

const DEFAULT_WORKERS = {
  analyzer: 'https://shadowsearch-api.tylerbrent017.workers.dev/analyzer',
  search: 'https://shadowsearch-api.tylerbrent017.workers.dev/search',
  insights: 'https://shadowsearch-api.tylerbrent017.workers.dev/insights',
  qa: 'https://shadowsearch-api.tylerbrent017.workers.dev/qa',
  analyze_question: 'https://shadowsearch-api.tylerbrent017.workers.dev/analyze_question',
  // YouTube worker endpoints (still local)
  youtube_detect: 'http://127.0.0.1:8788/detect-youtube',
  youtube_download: 'http://127.0.0.1:8788/download-video',
  youtube_analyze: 'http://127.0.0.1:8788/analyze-video',
  youtube_insights: 'http://127.0.0.1:8788/youtube-insights'
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ANALYZE_PAGE') {
    handleAnalysis(message.payload)
      .then((data) => {
        try { console.log('[ShadowSearch] Analysis result', JSON.stringify(data).slice(0, 2000)); } catch (_) {}
        sendResponse(data);
        if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_RESULT', payload: data });
      })
      .catch((err) => {
        const error = err?.message || 'Analysis failed';
        console.error('[ShadowSearch] Analysis error', error);
        sendResponse({ error });
        if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_ERROR', error });
      });
    return true; // async
  }
  if (message?.type === 'QUESTION') {
    // Choose endpoint based on Lumen toggle
    if (message.lumen) {
      // RAG mode - use vector database
      console.log('[ShadowSearch] 🔍 LUMEN ON - Starting RAG mode');
      console.log('[ShadowSearch] Query:', message.query, 'Topic:', lastTopic);
      
      callWorker('qa', { query: message.query, topic: lastTopic, sessionId: 'session_' + Date.now() }).then((resp) => {
        console.log('[ShadowSearch] 🔍 QA Response received:');
        console.log('[ShadowSearch] - Answer length:', resp.answer?.length || 0);
        console.log('[ShadowSearch] - Sources count:', resp.sources?.length || 0);
        console.log('[ShadowSearch] - Sources:', resp.sources?.map(s => ({ title: s.title, url: s.url, source: s.source })) || []);
        console.log('[ShadowSearch] - Inserted IDs:', resp.insertedIds?.length || 0);
        
        // Generate videos for RAG mode
        console.log('[ShadowSearch] Calling search for RAG mode with topic:', lastTopic, 'query:', message.query);
        callWorker('search', { topic: lastTopic, pageContent: '', query: message.query }).then((searchResp) => {
          console.log('[ShadowSearch] Search response for RAG:', searchResp);
          const payload = { insights: [resp.answer], videos: searchResp.videos || [], sources: resp.sources, qa: true };
          console.log('[ShadowSearch] 🔍 Sending payload to content script:', payload);
          if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_RESULT', payload });
        }).catch((e) => {
          console.error('[ShadowSearch] Search error for RAG:', e);
          const payload = { insights: [resp.answer], videos: [], sources: resp.sources, qa: true };
          console.log('[ShadowSearch] 🔍 Sending fallback payload to content script:', payload);
          if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_RESULT', payload });
        });
      }).catch((e) => {
        console.error('[ShadowSearch] QA error:', e);
        if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_ERROR', error: e?.message || 'QA failed' });
      });
    } else {
      // Page analysis mode - analyze current page content
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' }, (response) => {
            if (response) {
              callWorker('analyze_question', { 
                query: message.query, 
                title: response.title, 
                url: response.url, 
                text: response.text 
              }).then((resp) => {
                // Generate videos for page analysis mode
                console.log('[ShadowSearch] Calling search for page analysis with title:', response.title, 'query:', message.query);
                callWorker('search', { topic: response.title, pageContent: response.text, query: message.query }).then((searchResp) => {
                  console.log('[ShadowSearch] Search response for page analysis:', searchResp);
                  if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_RESULT', payload: { insights: [resp.answer], videos: searchResp.videos || [], sources: [], qa: true } });
                }).catch((e) => {
                  console.error('[ShadowSearch] Search error for page analysis:', e);
                  if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_RESULT', payload: { insights: [resp.answer], videos: [], sources: [], qa: true } });
                });
              }).catch((e) => {
                if (sender?.tab?.id) chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_ERROR', error: e?.message || 'Analysis failed' });
              });
            }
          });
        }
      });
    }
  }
});

async function handleAnalysis(payload) {
  const { title, url, text, isYouTube, videoId } = payload || {};
  
  // Handle YouTube-specific analysis
  if (isYouTube && videoId) {
    return handleYouTubeAnalysis({ title, url, text, videoId });
  }
  
  // Regular page analysis
  try {
    const analyzer = await callWorker('analyzer', { title, url, text });
    lastTopic = analyzer?.topic || null;
    const search = await callWorker('search', { topic: analyzer.topic, entities: analyzer.entities, pageContent: text, query: '' });
    const insights = await callWorker('insights', { analyzer, search });
    
    // Auto-run QA to populate Sources
    try {
      console.log('[ShadowSearch] Auto QA start', analyzer.topic);
      const qaResp = await callWorker('qa', { query: analyzer.topic || '', topic: lastTopic, sessionId: 'session_' + Date.now() });
      console.log('[ShadowSearch] Auto QA response', JSON.stringify(qaResp).slice(0, 500));
      return { ...insights, videos: search?.videos || [], sources: qaResp?.sources || [], qa: false };
    } catch (err) {
      console.warn('[ShadowSearch] Auto QA error', err?.message || err);
      return insights;
    }
  } catch (e) {
    // Fallback mock so the extension works out-of-the-box
    console.warn('Workers not reachable, using mock data:', e?.message);
    return mockInsights({ title, url, text });
  }
}

async function handleYouTubeAnalysis({ title, url, text, videoId }) {
  try {
    console.log('[ShadowSearch] YouTube analysis for video:', videoId);
    
    // Step 1: Download video (simulated for now)
    const downloadResult = await callWorker('youtube_download', { videoId, url });
    console.log('[ShadowSearch] Video download result:', downloadResult);
    
    // Step 2: Analyze video with Gemini
    const analysisResult = await callWorker('youtube_analyze', { 
      videoId, 
      videoPath: downloadResult.videoInfo?.localPath,
      analysisType: 'comprehensive'
    });
    console.log('[ShadowSearch] Video analysis result:', analysisResult);
    
    // Step 3: Generate YouTube-specific insights
    const insightsResult = await callWorker('youtube_insights', { 
      videoId, 
      analysis: analysisResult.analysis 
    });
    console.log('[ShadowSearch] YouTube insights result:', insightsResult);
    
    // Return YouTube-specific response
    return {
      insights: insightsResult.insights?.insights || [],
      takes: insightsResult.insights?.takes || [],
      videoAnalysis: analysisResult.analysis,
      isYouTube: true,
      videos: [], // No related videos for YouTube mode
      sources: [] // No sources for YouTube mode
    };
    
  } catch (e) {
    console.error('[ShadowSearch] YouTube analysis error:', e?.message || e);
    
    // Fallback for YouTube analysis
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

async function callWorker(name, body) {
  const { workers = {}, serperApiKey = '' } = await chrome.storage.sync.get(['workers', 'serperApiKey']);
  const base = workers[name] || DEFAULT_WORKERS[name];
  console.log('[ShadowSearch] Calling worker', name, base);
  
  // Add API key to body for search-related calls
  const requestBody = { ...body };
  if (name === 'search' && serperApiKey) {
    requestBody.serperApiKey = serperApiKey;
  }
  
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
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

function mockInsights({ title, url, text }) {
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



