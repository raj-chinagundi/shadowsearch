// Minimal DOM helper: HTML escaping
(function() {
  const dom = {
    escapeHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };
  window.__ss = window.__ss || {};
  window.__ss.dom = dom;
})();


