(() => {
  // Respect per-site disable and temporary hide
  chrome.storage.sync.get(['disabledHosts', 'hideUntil'], (items) => {
    const { hostname } = window.location;
    const disabledHosts = items.disabledHosts || {};
    const hideUntil = items.hideUntil || 0;
    if (disabledHosts[hostname]) return;
    if (Date.now() < hideUntil) return;
    inject();
  });

  function inject() {
    if (document.getElementById('ss-brain-root')) return;

    const root = document.createElement('div');
    root.id = 'ss-brain-root';
    root.setAttribute('aria-live', 'polite');
    document.documentElement.appendChild(root);

    const button = document.createElement('button');
    button.id = 'ss-brain-button';
    button.title = 'ShadowSearch - Analyze this page';
    button.innerHTML = '<span class="ss-brain-icon" />';

    button.addEventListener('click', (e) => {
      const r = document.createElement('span');
      r.className = 'ss-ripple';
      const rect = button.getBoundingClientRect();
      const x = (e.clientX || (rect.left + rect.width/2)) - rect.left;
      const y = (e.clientY || (rect.top + rect.height/2)) - rect.top;
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      button.appendChild(r);
      setTimeout(() => { r.remove(); }, 450);
      openOverlay();
      requestAnalysis();
    });


    root.appendChild(button);
  }

  function openOverlay() {
    if (document.getElementById('ss-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ss-overlay';
    overlay.innerHTML = `
      <div class="ss-overlay-backdrop"></div>
      <div class="ss-overlay-panel" role="dialog" aria-modal="true">
        <div class="ss-overlay-header">
          <div class="ss-brand">
            <span class="ss-logo" aria-hidden="true"></span>
            <span class="ss-title">ShadowSearch</span>
          </div>
          <div class="ss-session">
            <button class="ss-close" id="ss-close" title="Close">×</button>
          </div>
        </div>
        <div class="ss-search">
          <input id="ss-query" type="text" placeholder="Ask a question or search within this topic..." />
          <button id="ss-ask">🧠</button>
          <button id="ss-lumen" class="ss-lumen" title="Toggle external resources">💡</button>
        </div>
        <div class="ss-quick">
          <button class="ss-chip" data-q="Summarize this page">Summarize</button>
          <button class="ss-chip" data-q="What are the key points?">Key Points</button>
          <button class="ss-chip" data-q="Explain this like I am 5 years old">ELI5</button>
          <button class="ss-chip" data-q="What are the main concepts?">Concepts</button>
        </div>
        <div class="ss-body">
          <section>
            <h3>Instant Insights</h3>
            <div id="ss-insights" class="ss-card">
              <div class="ss-loading">Analyzing page…</div>
            </div>
          </section>
          <section id="ss-video-section">
            <h3>Video Analysis</h3>
            <div id="ss-video-analysis" class="ss-card ss-muted">Waiting for video analysis…</div>
          </section>
          <section id="ss-related-videos-section" style="display: none;">
            <h3>Related Videos</h3>
            <div id="ss-videos" class="ss-card ss-grid ss-muted">Waiting for results…</div>
          </section>
          <section id="ss-sources-section" style="display: none;">
            <h3>Sources</h3>
            <div id="ss-sources" class="ss-card ss-muted">Waiting for results…</div>
          </section>
        </div>
        <div class="ss-footer">
          <div class="ss-ephemeral">ShadowSearch Analysis</div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    document.getElementById('ss-close')?.addEventListener('click', closeOverlay);
    document.getElementById('ss-ask')?.addEventListener('click', ask);
    
    // Lumen toggle for external resources
    let lumenEnabled = false;
    document.getElementById('ss-lumen')?.addEventListener('click', () => {
      lumenEnabled = !lumenEnabled;
      const lumenBtn = document.getElementById('ss-lumen');
      if (lumenEnabled) {
        lumenBtn.classList.add('active');
      } else {
        lumenBtn.classList.remove('active');
      }
      console.log('[ShadowSearch] Lumen mode:', lumenEnabled ? 'ON' : 'OFF');
      try { 
        console.log('[ShadowSearch] Sending LUMEN_TOGGLE message:', { type: 'LUMEN_TOGGLE', enabled: lumenEnabled });
        chrome.runtime.sendMessage({ type: 'LUMEN_TOGGLE', enabled: lumenEnabled }); 
      } catch (e) {
        console.error('[ShadowSearch] Failed to send LUMEN_TOGGLE:', e);
      }
    });
    document.querySelectorAll('.ss-chip').forEach((el) => {
      el.addEventListener('click', () => {
        const preset = el.getAttribute('data-q') || '';
        const input = document.getElementById('ss-query');
        if (input) input.value = preset;
        ask();
      });
    });

  }

  function closeOverlay() {
    const overlay = document.getElementById('ss-overlay');
    try { 
      console.log('[ShadowSearch] Sending SESSION_END message');
      chrome.runtime.sendMessage({ type: 'SESSION_END' }, (response) => {
        console.log('[ShadowSearch] SESSION_END response:', response);
      }); 
    } catch (e) {
      console.error('[ShadowSearch] Failed to send SESSION_END:', e);
    }
    if (overlay) overlay.remove();
  }

  function ask() {
    const input = document.getElementById('ss-query');
    const q = input && 'value' in input ? input.value : '';
    const lumenBtn = document.getElementById('ss-lumen');
    const lumenEnabled = lumenBtn && lumenBtn.classList.contains('active');
    console.log('[ShadowSearch] Asking question:', q, 'Lumen:', lumenEnabled);
    chrome.runtime.sendMessage({ type: 'QUESTION', query: q, lumen: lumenEnabled });
  }

  function requestAnalysis() {
    const text = (window.__ss?.extractors?.extractReadableText || extractReadableText)();
    const title = document.title;
    const url = location.href;
    
    // Check if this is a YouTube page
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const videoId = (window.__ss?.extractors?.extractVideoId || extractVideoId)(url);

    chrome.runtime.sendMessage({
      type: 'ANALYZE_PAGE',
      payload: { title, url, text, isYouTube, videoId }
    }, (response) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message);
        return;
      }
      if (!response) return;
      updateOverlay(response);
    });
  }
  
  function extractVideoId(url) {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      } else if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.slice(1);
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  function setError(message) {
    const insights = document.getElementById('ss-insights');
    const esc = window.__ss?.dom?.escapeHtml || escapeHtml;
    if (insights) insights.innerHTML = `<div class="ss-error">${esc(message)}</div>`;
  }

  function updateOverlay(data) {
    // Delegate to overlay renderer module for DOM updates
    if (window.__ss?.overlay?.renderOverlayData) {
      window.__ss.overlay.renderOverlayData(data);
      return;
    }
    // Fallback to in-file renderer (kept for compatibility)
    const { insights = [], videos = [], sources = [], videoAnalysis = null, isYouTube = false } = data || {};
    const esc = window.__ss?.dom?.escapeHtml || escapeHtml;
    const insightsEl = document.getElementById('ss-insights');
    const videosEl = document.getElementById('ss-videos');
    const sourcesEl = document.getElementById('ss-sources');
    const videoAnalysisEl = document.getElementById('ss-video-analysis');
    const videoSection = document.getElementById('ss-video-section');
    const relatedVideosSection = document.getElementById('ss-related-videos-section');
    const sourcesSection = document.getElementById('ss-sources-section');
    if (isYouTube) { videoSection.style.display = 'block'; relatedVideosSection.style.display = 'none'; sourcesSection.style.display = 'none'; }
    else { videoSection.style.display = 'none'; relatedVideosSection.style.display = 'block'; sourcesSection.style.display = 'block'; }
    if (insightsEl) { insightsEl.innerHTML = insights.length ? `<ul>${insights.map((i)=>{ const lines=i.split('\n').filter(l=>l.trim()); return lines.length>1?lines.map(line=>`<li>• ${esc(line.trim())}</li>`).join(''):`<li>• ${esc(i)}</li>`; }).join('')}</ul>` : '<div class="ss-empty">No insights found.</div>'; }
    if (videoAnalysisEl) { if (videoAnalysis) { videoAnalysisEl.classList.remove('ss-muted'); videoAnalysisEl.innerHTML = `<div class="ss-video-analysis-content"><h4>AI Video Analysis</h4><div class="ss-analysis-text">${esc(videoAnalysis.result || 'Analysis not available')}</div>${videoAnalysis.educationalValue ? `<div class=\"ss-educational-value\"><strong>Educational Value:</strong> ${esc(videoAnalysis.educationalValue)}</div>` : ''}${videoAnalysis.targetAudience ? `<div class=\"ss-target-audience\"><strong>Target Audience:</strong> ${esc(videoAnalysis.targetAudience)}</div>` : ''}</div>`; } else { videoAnalysisEl.innerHTML = '<div class="ss-empty">Video analysis not available.</div>'; } }
    if (videosEl) { videosEl.classList.remove('ss-muted'); videosEl.innerHTML = videos.length ? videos.map((v)=>`<a class=\"ss-video-card\" href=\"${encodeURI(v.url)}\" target=\"_blank\" rel=\"noreferrer\"><img src=\"${v.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiB2aWV3Qm94PSIwIDAgMzIwIDE4MCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxODAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSIxNjAiIHk9IjkwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyB0aHVtYm5haWw8L3RleHQ+PC9zdmc+'}\" alt=\"${esc(v.title)}\" class=\"ss-video-thumb\" /><div class=\"ss-video-info\"><h4 class=\"ss-video-title\">${esc(v.title)}</h4><p class=\"ss-video-channel\">${esc(v.channel || 'Unknown')}</p></div></a>`).join('') : '<div class="ss-empty">No related videos.</div>'; }
    if (sourcesEl) { sourcesEl.classList.remove('ss-muted'); sourcesEl.innerHTML = sources.length ? `<ul>${sources.map((s)=>`<li><a href=\"${encodeURI(s.url)}\" target=\"_blank\" rel=\"noreferrer\">${esc(s.title || s.url)}${s.source ? ` — ${esc(s.source)}` : ''}</a></li>`).join('')}</ul>` : '<div class="ss-empty">No sources.</div>'; }
  }

  function extractReadableText() { return (window.__ss?.extractors?.extractReadableText || function(){ return ''; })(); }


  // Receive updates from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'ANALYSIS_RESULT') updateOverlay(msg.payload);
    if (msg?.type === 'ANALYSIS_ERROR') setError(msg.error || 'Unknown error');
    if (msg?.type === 'GET_PAGE_CONTENT') {
      const text = (window.__ss?.extractors?.extractReadableText || extractReadableText)();
      const title = document.title;
      const url = location.href;
      sendResponse({ title, url, text });
    }
  });

  function escapeHtml(s) { return (window.__ss?.dom?.escapeHtml || ((x)=>String(x)))(s); }
})();


