(function() {
  function renderOverlayData(data) {
    const d = data || {};
    const hasInsights = Object.prototype.hasOwnProperty.call(d, 'insights');
    const insights = hasInsights ? (Array.isArray(d.insights) ? d.insights : []) : undefined;
    const hasVideos = Object.prototype.hasOwnProperty.call(d, 'videos');
    const videos = hasVideos ? (Array.isArray(d.videos) ? d.videos : []) : undefined;
    const hasSources = Object.prototype.hasOwnProperty.call(d, 'sources');
    const sources = hasSources ? (Array.isArray(d.sources) ? d.sources : []) : undefined;
    const videoAnalysis = d.videoAnalysis || null;
    const isYouTube = !!d.isYouTube;
    const insightsEl = document.getElementById('ss-insights');
    const videosEl = document.getElementById('ss-videos');
    const sourcesEl = document.getElementById('ss-sources');
    const videoAnalysisEl = document.getElementById('ss-video-analysis');
    const videoSection = document.getElementById('ss-video-section');
    const relatedVideosSection = document.getElementById('ss-related-videos-section');
    const sourcesSection = document.getElementById('ss-sources-section');

    if (isYouTube) {
      // Hide Video Analysis section on YouTube pages per request
      if (videoSection) videoSection.style.display = 'none';
      if (relatedVideosSection) relatedVideosSection.style.display = 'none';
      if (sourcesSection) sourcesSection.style.display = 'none';
    } else {
      if (videoSection) videoSection.style.display = 'none';
      if (relatedVideosSection) relatedVideosSection.style.display = 'block';
      if (sourcesSection) sourcesSection.style.display = 'block';
    }

    if (insightsEl && hasInsights) {
      // If insights payload is present but empty, keep existing content to avoid flicker
      if (!Array.isArray(insights) || insights.length === 0) {
        // do not overwrite; maintain prior state (e.g., Analyzing…)
      } else {
        insightsEl.innerHTML = `<ul>${insights.map((i) => {
          const lines = i.split('\n').filter(line => line.trim());
          if (lines.length > 1) {
            return lines.map(line => `<li>• ${window.__ss.dom.escapeHtml(line.trim())}</li>`).join('');
          }
          return `<li>• ${window.__ss.dom.escapeHtml(i)}</li>`;
        }).join('')}</ul>`;
      }
    }

    if (videoAnalysisEl && !isYouTube) {
      if (videoAnalysis) {
        videoAnalysisEl.classList.remove('ss-muted');
        videoAnalysisEl.innerHTML = `
          <div class="ss-video-analysis-content">
            <h4>AI Video Analysis</h4>
            <div class="ss-analysis-text">${window.__ss.dom.escapeHtml(videoAnalysis.result || 'Analysis not available')}</div>
            ${videoAnalysis.educationalValue ? `<div class="ss-educational-value"><strong>Educational Value:</strong> ${window.__ss.dom.escapeHtml(videoAnalysis.educationalValue)}</div>` : ''}
            ${videoAnalysis.targetAudience ? `<div class="ss-target-audience"><strong>Target Audience:</strong> ${window.__ss.dom.escapeHtml(videoAnalysis.targetAudience)}</div>` : ''}
          </div>
        `;
      } else {
        videoAnalysisEl.innerHTML = '<div class="ss-empty">Video analysis not available.</div>';
      }
    }

    if (videosEl && hasVideos) {
      // Keep prior content until we have items; avoids flicker from switching to loading repeatedly
      if (Array.isArray(videos) && videos.length) {
        videosEl.classList.remove('ss-muted');
        videosEl.innerHTML = videos.map((v) => `
          <a class="ss-video-card" href="${encodeURI(v.url)}" target="_blank" rel="noreferrer">
            <img src="${v.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiB2aWV3Qm94PSIwIDAgMzIwIDE4MCI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxODAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSIxNjAiIHk9IjkwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyB0aHVtYm5haWw8L3RleHQ+PC9zdmc+'}" 
                 alt="${window.__ss.dom.escapeHtml(v.title)}" class="ss-video-thumb" />
            <div class="ss-video-info">
              <h4 class="ss-video-title">${window.__ss.dom.escapeHtml(v.title)}</h4>
              <p class="ss-video-channel">${window.__ss.dom.escapeHtml(v.channel || 'Unknown')}</p>
            </div>
          </a>
        `).join('');
      } else if (!videosEl.innerHTML || /ss-empty|ss-loading/.test(videosEl.innerHTML)) {
        // Only set loading if currently empty or previously loading/empty; otherwise keep previous results
        videosEl.classList.remove('ss-muted');
        videosEl.innerHTML = '<div class="ss-loading">Loading related videos…</div>';
      }
    }

    if (sourcesEl && hasSources) {
      if (Array.isArray(sources) && sources.length) {
        sourcesEl.classList.remove('ss-muted');
        sourcesEl.innerHTML = `<ul>${sources.map((s) => `<li><a href="${encodeURI(s.url)}" target="_blank" rel="noreferrer">${window.__ss.dom.escapeHtml(s.title || s.url)}${s.source ? ` — ${window.__ss.dom.escapeHtml(s.source)}` : ''}</a></li>`).join('')}</ul>`;
      } else if (!sourcesEl.innerHTML || /ss-empty|ss-loading/.test(sourcesEl.innerHTML)) {
        sourcesEl.classList.remove('ss-muted');
        sourcesEl.innerHTML = '<div class="ss-loading">Loading sources…</div>';
      }
    }
  }

  window.__ss = window.__ss || {};
  window.__ss.overlay = { renderOverlayData };
})();


