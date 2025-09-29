import { extractText } from '../utils/text.js';

export async function fetchArticleContent(url, source) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ShadowSearch/1.0 (+https://shadowsearch.example)',
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    const extractedText = extractText(html);
    return extractedText.slice(0, 2000);
  } catch (e) {
    console.warn('[QA] Failed to fetch content from', url, e.message);
    return '';
  }
}


