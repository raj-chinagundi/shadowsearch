import { json } from '../utils/cors.js';

export async function viewR2ContentRoute(env) {
  try {
    console.log('[R2Viewer] Listing R2 content...');
    const objects = await env.CONTENT_BUCKET.list();
    const contentList = [];
    console.log(`[R2Viewer] Found ${objects.objects.length} objects`);
    for (const obj of objects.objects) {
      try {
        const content = await env.CONTENT_BUCKET.get(obj.key);
        if (content) {
          const data = await content.json();
          contentList.push({
            key: obj.key,
            title: data.title,
            url: data.url,
            source: data.source,
            contentLength: data.content?.length || 0,
            timestamp: data.timestamp,
            sessionId: data.sessionId,
            contentPreview: data.content?.slice(0, 200) + '...' || 'No content'
          });
        }
      } catch (error) {
        console.log(`[R2Viewer] Error reading ${obj.key}:`, error.message);
        contentList.push({ key: obj.key, error: error.message });
      }
    }
    console.log(`[R2Viewer] Successfully processed ${contentList.length} objects`);
    return json({ count: contentList.length, objects: contentList, message: 'R2 content retrieved successfully' });
  } catch (error) {
    console.error('[R2Viewer error]', error?.message || error);
    return json({ error: error.message }, { status: 500 });
  }
}


