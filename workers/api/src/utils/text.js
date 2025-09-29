export function clean(s) { return s.replace(/\n|\r/g, ' ').replace(/\s+/g, ' ').trim(); }
export function hash(s) { let h = 0; for (let i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i)|0; return String(h>>>0); }
export function extractText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function safeJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (_) { }
    }
    return null;
  }
}
export function firstSentence(t) { return (t || '').split(/[.!?]/)[0]?.trim(); }
export function keywordGuess(t) {
  const words = (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const stop = new Set(['the','and','for','that','with','this','have','from','are','was','you','your','but','not','all','any','can','has','our','their','its','into','over','more','than','also','about']);
  const counts = new Map();
  for (const w of words) { if (!stop.has(w) && w.length > 3) counts.set(w, (counts.get(w) || 0) + 1); }
  return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
}
export function arr(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}


