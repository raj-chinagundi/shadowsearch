// Session management helpers for per-tab, per-mode sessions
import { getApiBaseUrl } from './workers-client.js';

export const tabSessions = {};

export function genSessionId(tabId, mode) {
  return `session_${tabId}_${mode}_${Date.now()}`;
}

export function getOrCreateSession(tabId, isLumenOn) {
  const mode = isLumenOn ? 'on' : 'off';
  if (!tabSessions[tabId]) tabSessions[tabId] = {};
  if (!tabSessions[tabId][mode]) {
    tabSessions[tabId][mode] = genSessionId(tabId, mode);
    console.log('[ShadowSearch] Created session:', mode, 'for tab', tabId);
  }
  return tabSessions[tabId][mode];
}

export async function clearSessionOnServer(sessionId) {
  try {
    if (!sessionId) return;
    const { workers = {} } = await chrome.storage.sync.get(['workers']);
    const base = getApiBaseUrl(workers);
    const response = await fetch(`${base}/clear-session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    const result = await response.json();
    if (result.deleted > 0) {
      console.log('[ShadowSearch] Cleaned', result.deleted, 'objects from R2');
    }
  } catch (e) {
    console.warn('[ShadowSearch] Cleanup failed:', e?.message || e);
  }
}


