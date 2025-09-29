export async function fetchYouTube(q, env) {
  try {
    console.log('[YouTube] Searching YouTube for query:', q);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`YouTube search failed: ${response.status}`);
    }
    const html = await response.text();
    const videos = parseYouTubeSearchResults(html).slice(0, 4);
    console.log('[YouTube] Parsed videos:', videos.length);
    return videos;
  } catch (e) {
    console.error('[YouTube] Search Error:', e?.message || e);
    return [];
  }
}

export function parseYouTubeSearchResults(html) {
  try {
    const videos = [];
    const initialDataMatch = html.match(/var ytInitialData = ({.+?});/);
    if (!initialDataMatch) {
      console.log('[YouTube] No initial data found');
      return videos;
    }
    const initialData = JSON.parse(initialDataMatch[1]);
    const contents = initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    if (!contents) {
      console.log('[YouTube] No contents found in initial data');
      return videos;
    }
    for (const item of contents) {
      if (item.videoRenderer) {
        const video = item.videoRenderer;
        const videoId = video.videoId;
        const title = video.title?.runs?.[0]?.text || 'Unknown Title';
        const channel = video.ownerText?.runs?.[0]?.text || 'Unknown Channel';
        const thumbnail = video.thumbnail?.thumbnails?.[0]?.url || '';
        const duration = video.lengthText?.simpleText || '';
        const views = video.viewCountText?.simpleText || '';
        const published = video.publishedTimeText?.simpleText || '';
        if (videoId && title !== 'Unknown Title') {
          videos.push({ id: videoId, title, url: `https://www.youtube.com/watch?v=${videoId}`, thumbnail, channel, publishedAt: published, duration, views });
        }
      }
    }
    console.log('[YouTube] Successfully parsed', videos.length, 'videos');
    return videos;
  } catch (e) {
    console.error('[YouTube] Parse error:', e?.message || e);
    return [];
  }
}


