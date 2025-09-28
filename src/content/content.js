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
    const text = extractReadableText();
    const title = document.title;
    const url = location.href;
    
    // Check if this is a YouTube page
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const videoId = extractVideoId(url);

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
    if (insights) insights.innerHTML = `<div class="ss-error">${escapeHtml(message)}</div>`;
  }

  function updateOverlay(data) {
    const { insights = [], videos = [], sources = [], videoAnalysis = null, isYouTube = false } = data || {};
    console.log('[Content] 🔍 updateOverlay called with data:', data);
    console.log('[Content] 🔍 Sources in updateOverlay:', sources);
    const insightsEl = document.getElementById('ss-insights');
    const videosEl = document.getElementById('ss-videos');
    const sourcesEl = document.getElementById('ss-sources');
    const videoAnalysisEl = document.getElementById('ss-video-analysis');
    const videoSection = document.getElementById('ss-video-section');
    const relatedVideosSection = document.getElementById('ss-related-videos-section');
    const sourcesSection = document.getElementById('ss-sources-section');

    // Show/hide sections based on whether this is YouTube
    if (isYouTube) {
      videoSection.style.display = 'block';
      relatedVideosSection.style.display = 'none';
      sourcesSection.style.display = 'none';
    } else {
      videoSection.style.display = 'none';
      relatedVideosSection.style.display = 'block';
      sourcesSection.style.display = 'block';
    }

    if (insightsEl) {
      if (!insights.length) {
        insightsEl.innerHTML = '<div class="ss-empty">No insights found.</div>';
      } else {
        insightsEl.innerHTML = `<ul>${insights.map((i) => {
          // Split long answers into multiple lines for better formatting
          const lines = i.split('\n').filter(line => line.trim());
          if (lines.length > 1) {
            return lines.map(line => `<li>• ${escapeHtml(line.trim())}</li>`).join('');
          }
          return `<li>• ${escapeHtml(i)}</li>`;
        }).join('')}</ul>`;
      }
    }

    // Handle video analysis for YouTube
    if (videoAnalysisEl) {
      if (videoAnalysis) {
        videoAnalysisEl.classList.remove('ss-muted');
        videoAnalysisEl.innerHTML = `
          <div class="ss-video-analysis-content">
            <h4>AI Video Analysis</h4>
            <div class="ss-analysis-text">${escapeHtml(videoAnalysis.result || 'Analysis not available')}</div>
            ${videoAnalysis.educationalValue ? `<div class="ss-educational-value"><strong>Educational Value:</strong> ${escapeHtml(videoAnalysis.educationalValue)}</div>` : ''}
            ${videoAnalysis.targetAudience ? `<div class="ss-target-audience"><strong>Target Audience:</strong> ${escapeHtml(videoAnalysis.targetAudience)}</div>` : ''}
          </div>
        `;
      } else {
        videoAnalysisEl.innerHTML = '<div class="ss-empty">Video analysis not available.</div>';
      }
    }

    if (videosEl) {
      videosEl.classList.remove('ss-muted');
      if (videos.length) {
        videosEl.innerHTML = videos.map((v) => `
          <a class="ss-video-card" href="${encodeURI(v.url)}" target="_blank" rel="noreferrer">
            <img src="${v.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiB2aWV3Qm94PSIwIDAgMzIwIDE4MCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxODAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSIxNjAiIHk9IjkwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyB0aHVtYm5haWw8L3RleHQ+PC9zdmc+'}" 
                 alt="${escapeHtml(v.title)}" class="ss-video-thumb" />
            <div class="ss-video-info">
              <h4 class="ss-video-title">${escapeHtml(v.title)}</h4>
              <p class="ss-video-channel">${escapeHtml(v.channel || 'Unknown')}</p>
            </div>
          </a>
        `).join('');
      } else {
        videosEl.innerHTML = '<div class="ss-empty">No related videos.</div>';
      }
    }
    if (sourcesEl) {
      console.log('[Content] 🔍 Rendering sources:', sources);
      sourcesEl.classList.remove('ss-muted');
      sourcesEl.innerHTML = sources.length ? `<ul>${sources.map((s) => `<li><a href="${encodeURI(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(s.title || s.url)}${s.source ? ` — ${escapeHtml(s.source)}` : ''}</a></li>`).join('')}</ul>` : '<div class="ss-empty">No sources.</div>';
      console.log('[Content] 🔍 Sources HTML set:', sourcesEl.innerHTML);
    }
  }

  function extractReadableText() {
    const article = document.querySelector('article');
    const main = document.querySelector('main');
    const candidate = article || main || document.body;
    const clone = candidate.cloneNode(true);
    // Remove script/style/nav/aside
    clone.querySelectorAll('script,style,nav,aside,footer,header').forEach((n) => n.remove());
    const text = clone.innerText || '';
    return text.trim().replace(/\s+/g, ' ').slice(0, 20000);
  }


  // Receive updates from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'ANALYSIS_RESULT') updateOverlay(msg.payload);
    if (msg?.type === 'ANALYSIS_ERROR') setError(msg.error || 'Unknown error');
    if (msg?.type === 'GET_PAGE_CONTENT') {
      const text = extractReadableText();
      const title = document.title;
      const url = location.href;
      sendResponse({ title, url, text });
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();


