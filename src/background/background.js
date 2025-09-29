// Background service worker for ShadowSearch
import { DEFAULT_WORKERS, callWorker } from './workers-client.js';
import { tabSessions, genSessionId, getOrCreateSession, clearSessionOnServer } from './sessions.js';
import { handleAnalysis, handleYouTubeAnalysis, setLastTabId, getLastTopic } from './flows/analyze-page.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Handle async messages that don't need responses
  if (message?.type === 'LUMEN_TOGGLE') {
    const tabId = sender?.tab?.id;
    console.log('[ShadowSearch] LUMEN_TOGGLE received:', tabId, message.enabled);
    if (tabId === undefined) return true;
    const newMode = message.enabled ? 'on' : 'off';
    const oldMode = message.enabled ? 'off' : 'on';
    const oldSession = tabSessions[tabId]?.[oldMode];
    const newSessionExisting = tabSessions[tabId]?.[newMode];
    console.log('[ShadowSearch] Old mode/session to clear:', oldMode, oldSession);
    console.log('[ShadowSearch] Existing session in new mode (will be replaced):', newMode, newSessionExisting);
    Promise.resolve()
      .then(() => oldSession ? clearSessionOnServer(oldSession) : undefined)
      .then(() => {
        if (!tabSessions[tabId]) tabSessions[tabId] = {};
        tabSessions[tabId][newMode] = genSessionId(tabId, newMode);
        console.log('[ShadowSearch] Lumen toggled, new session:', tabId, newMode, tabSessions[tabId][newMode]);
      })
      .catch(() => {});
    return true; // async
  }
  
  if (message?.type === 'SESSION_END') {
    const tabId = sender?.tab?.id;
    console.log('[ShadowSearch] SESSION_END received for tab:', tabId);
    if (tabId === undefined) {
      sendResponse({ error: 'No tab ID' });
      return true;
    }
    const sessions = tabSessions[tabId] || {};
    console.log('[ShadowSearch] All sessions for tab', tabId, ':', sessions);
    console.log('[ShadowSearch] ON session:', sessions.on);
    console.log('[ShadowSearch] OFF session:', sessions.off);
    
    const tasks = [];
    if (sessions.on) {
      console.log('[ShadowSearch] Will clear ON session:', sessions.on);
      tasks.push(clearSessionOnServer(sessions.on));
    }
    if (sessions.off) {
      console.log('[ShadowSearch] Will clear OFF session:', sessions.off);
      tasks.push(clearSessionOnServer(sessions.off));
    }
    
    console.log('[ShadowSearch] Total tasks to execute:', tasks.length);
    
    Promise.allSettled(tasks).finally(() => { 
      console.log('[ShadowSearch] All clear tasks completed for tab:', tabId);
      delete tabSessions[tabId]; 
      sendResponse({ success: true, cleared: Object.keys(sessions).length });
    });
    return true; // async
  }
  
  if (message?.type === 'ANALYZE_PAGE') {
    if (sender?.tab?.id !== undefined) { setLastTabId(sender.tab.id); }
    handleAnalysis(sender?.tab?.id, message.payload)
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
      console.log('[ShadowSearch] Query:', message.query, 'Topic:', getLastTopic());
      
      const sessionId = getOrCreateSession(sender?.tab?.id ?? 0, true);
      const topic = getLastTopic();
      callWorker('qa', { query: message.query, topic, sessionId }).then((resp) => {
        console.log('[ShadowSearch] 🔍 QA Response received:');
        console.log('[ShadowSearch] - Answer length:', resp.answer?.length || 0);
        console.log('[ShadowSearch] - Sources count:', resp.sources?.length || 0);
        console.log('[ShadowSearch] - Sources:', resp.sources?.map(s => ({ title: s.title, url: s.url, source: s.source })) || []);
        console.log('[ShadowSearch] - Inserted IDs:', resp.insertedIds?.length || 0);
        
        // Generate videos for RAG mode
        console.log('[ShadowSearch] Calling search for RAG mode with topic:', topic, 'query:', message.query);
        callWorker('search', { topic, pageContent: '', query: message.query }).then((searchResp) => {
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



// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log('[ShadowSearch] Tab closed:', tabId);
  const sessions = tabSessions[tabId];
  if (!sessions) {
    console.log('[ShadowSearch] No sessions found for tab:', tabId);
    return;
  }
  console.log('[ShadowSearch] Sessions to clear on tab close:', sessions);
  const tasks = [];
  if (sessions.on) tasks.push(clearSessionOnServer(sessions.on));
  if (sessions.off) tasks.push(clearSessionOnServer(sessions.off));
  Promise.allSettled(tasks).finally(() => { 
    console.log('[ShadowSearch] Cleared sessions on tab close:', tabId);
    delete tabSessions[tabId]; 
  });
});
