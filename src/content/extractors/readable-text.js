(function() {
  function extractReadableText() {
    const article = document.querySelector('article');
    const main = document.querySelector('main');
    const candidate = article || main || document.body;
    const clone = candidate.cloneNode(true);
    clone.querySelectorAll('script,style,nav,aside,footer,header').forEach((n) => n.remove());
    const text = clone.innerText || '';
    return text.trim().replace(/\s+/g, ' ').slice(0, 20000);
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

  window.__ss = window.__ss || {};
  window.__ss.extractors = { extractReadableText, extractVideoId };
})();


