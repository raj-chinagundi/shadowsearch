document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { workers = {}, serperApiKey = '' } = await chrome.storage.sync.get(['workers', 'serperApiKey']);
    
    // Load worker endpoints
    for (const id of ['analyzer','search','insights','qa']) {
      const el = document.getElementById(id);
      if (el) el.value = workers[id] || '';
    }
    
    // Load API key
    const apiKeyEl = document.getElementById('serperApiKey');
    if (apiKeyEl) apiKeyEl.value = serperApiKey;
    
  } catch (e) {
    console.error('Load options failed', e);
  }

  document.getElementById('save')?.addEventListener('click', async () => {
    try {
      const serperApiKey = document.getElementById('serperApiKey').value.trim();
      
      // Validate API key format (basic check)
      if (serperApiKey && serperApiKey.length < 10) {
        alert('Please enter a valid Serper API key (at least 10 characters)');
        return;
      }
      
      const next = { 
        workers: {
          analyzer: document.getElementById('analyzer').value.trim(),
          search: document.getElementById('search').value.trim(),
          insights: document.getElementById('insights').value.trim(),
          qa: document.getElementById('qa').value.trim()
        },
        serperApiKey: serperApiKey
      };
      
      await chrome.storage.sync.set(next);
      const btn = document.getElementById('save');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Saved ✓';
        setTimeout(() => (btn.textContent = prev), 1200);
      }
    } catch (e) {
      console.error('Save options failed', e);
      alert('Save failed: ' + (e?.message || 'unknown error'));
    }
  });
});


