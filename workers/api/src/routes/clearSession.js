import { json } from '../utils/cors.js';

export async function clearSessionRoute(env, { sessionId = '' }) {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return json({ error: 'sessionId required' }, { status: 400 });
    }
    const prefix = `content/${sessionId}/`;
    console.log('[ClearSession] Clearing prefix:', prefix);
    const toDelete = [];
    let cursor = undefined;
    do {
      const listResp = await env.CONTENT_BUCKET.list({ prefix, cursor });
      for (const obj of listResp.objects) {
        toDelete.push(obj.key);
      }
      cursor = listResp.truncated ? listResp.cursor : undefined;
    } while (cursor);
    if (toDelete.length) {
      await Promise.allSettled(toDelete.map((key) => env.CONTENT_BUCKET.delete(key)));
    }
    console.log('[ClearSession] Deleted objects:', toDelete.length);
    return json({ ok: true, deleted: toDelete.length });
  } catch (e) {
    console.error('[ClearSession error]', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}


