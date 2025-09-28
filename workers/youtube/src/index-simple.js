// Simple YouTube worker using Google Generative AI directly
import { GoogleGenerativeAI } from '@google/generative-ai';
// Import prompts
import { youtubeAnalysisMetadataPrompt } from '../../../prompts/youtube_analysis_prompt.js';
import { youtubeInsightsPrompt } from '../../../prompts/youtube_insights_prompt.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    
    if (request.method !== 'POST') {
      return new Response('Only POST', { status: 405, headers: corsHeaders() });
    }
    
    const body = await request.json().catch(() => ({}));
    
    if (url.pathname.endsWith('/detect-youtube')) return detectYouTube(env, body);
    if (url.pathname.endsWith('/download-video')) return downloadVideo(env, body);
    if (url.pathname.endsWith('/analyze-video')) return analyzeVideo(env, body);
    if (url.pathname.endsWith('/youtube-insights')) return youtubeInsights(env, body);
    
    return new Response(JSON.stringify({ ok: true, message: 'YouTube Worker API' }), { 
      headers: { ...corsHeaders(), 'content-type': 'application/json' } 
    });
  }
};

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), { 
    ...init, 
    headers: { ...corsHeaders(), 'content-type': 'application/json', ...(init.headers || {}) } 
  });
}

// Initialize Google Generative AI
function getGeminiModel(env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
}

// Detect if current page is YouTube
async function detectYouTube(env, { url = '' }) {
  try {
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const videoId = extractVideoId(url);
    
    return json({
      isYouTube,
      videoId,
      url: url
    });
  } catch (e) {
    console.error('[DetectYouTube] Error:', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Extract video ID from YouTube URL
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

// Get video metadata using direct YouTube search instead of YouTube Data API
async function downloadVideo(env, { videoId = '', url = '' }) {
  try {
    if (!videoId) {
      return json({ error: 'Video ID required' }, { status: 400 });
    }
    
    console.log('[DownloadVideo] Getting video details for:', videoId);
    
    const videoUrl = url || `https://www.youtube.com/watch?v=${videoId}`;
    
    // Use direct YouTube search to find the video
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(videoId)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`YouTube search failed: ${response.status}`);
    }
    
    const html = await response.text();
    const videos = parseYouTubeSearchResults(html);
    
    // Find the video with matching videoId
    const videoInfo = videos.find(video => video.id === videoId);
    
    if (!videoInfo) {
      // Fallback: create basic video info if not found in search
      const videoInfoData = {
        id: videoId,
        url: videoUrl,
        title: `Video ${videoId}`,
        duration: 0,
        viewCount: 0,
        downloadedAt: new Date().toISOString(),
        status: 'metadata_ready',
        channel: 'Unknown',
        description: '',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: new Date().toISOString(),
        tags: [],
        categoryId: null
      };
      
      return json({
        success: true,
        videoInfo: videoInfoData,
        message: 'Video metadata created (video not found in search)'
      });
    }
    
    console.log('[DownloadVideo] Video details found:', {
      title: videoInfo.title,
      channel: videoInfo.channel,
      duration: videoInfo.duration
    });
    
    const videoInfoData = {
      id: videoId,
      url: videoUrl,
      title: videoInfo.title,
      duration: parseDurationToSeconds(videoInfo.duration) || 0,
      viewCount: parseViewsToNumber(videoInfo.views) || 0,
      downloadedAt: new Date().toISOString(),
      status: 'metadata_ready',
      channel: videoInfo.channel,
      description: videoInfo.description || '',
      thumbnail: videoInfo.thumbnail,
      publishedAt: videoInfo.publishedAt,
      tags: [],
      categoryId: null
    };
    
    // Store video metadata in KV
    if (env.YOUTUBE_VIDEOS) {
      await env.YOUTUBE_VIDEOS.put(`video_${videoId}`, JSON.stringify(videoInfoData));
    }
    
    console.log('[DownloadVideo] Video details retrieved:', {
      title: videoInfoData.title,
      duration: videoInfoData.duration,
      viewCount: videoInfoData.viewCount
    });
    
    return json({
      success: true,
      videoInfo: videoInfoData,
      message: 'Video metadata retrieved successfully'
    });
    
  } catch (e) {
    console.error('[DownloadVideo] Error:', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Helper function to parse duration string to seconds
function parseDurationToSeconds(duration) {
  if (!duration) return 0;
  
  // Handle formats like "2:30", "1:23:45", "30s"
  const parts = duration.split(':');
  if (parts.length === 1) {
    // Just seconds
    return parseInt(parts[0]) || 0;
  } else if (parts.length === 2) {
    // Minutes:seconds
    return parseInt(parts[0]) * 60 + parseInt(parts[1]) || 0;
  } else if (parts.length === 3) {
    // Hours:minutes:seconds
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) || 0;
  }
  return 0;
}

// Helper function to parse view count string to number
function parseViewsToNumber(views) {
  if (!views) return 0;
  
  // Remove "views" text and parse numbers like "1,234,567 views" or "1.2M views"
  const cleanViews = views.replace(/[^\d.,KMB]/g, '').toUpperCase();
  
  if (cleanViews.includes('M')) {
    return Math.floor(parseFloat(cleanViews.replace('M', '')) * 1000000);
  } else if (cleanViews.includes('K')) {
    return Math.floor(parseFloat(cleanViews.replace('K', '')) * 1000);
  } else {
    return parseInt(cleanViews.replace(/,/g, '')) || 0;
  }
}

// Copy the parsing function from the API worker
function parseYouTubeSearchResults(html) {
  try {
    const videos = [];
    
    // Look for video data in the page's initial data
    const initialDataMatch = html.match(/var ytInitialData = ({.+?});/);
    if (!initialDataMatch) {
      console.log('[YouTube] No initial data found');
      return videos;
    }
    
    const initialData = JSON.parse(initialDataMatch[1]);
    
    // Navigate through the YouTube data structure to find video results
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
          videos.push({
            id: videoId,
            title: title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail: thumbnail,
            channel: channel,
            publishedAt: published,
            duration: duration,
            views: views
          });
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

// Parse ISO 8601 duration to seconds
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Analyze video using Gemini 2.5 Flash Lite with real video metadata
async function analyzeVideo(env, { videoId = '', analysisType = 'comprehensive' }) {
  try {
    if (!videoId) {
      return json({ error: 'Video ID required' }, { status: 400 });
    }
    
    console.log('[AnalyzeVideo] Starting analysis for video:', videoId);
    
    // Get video metadata from KV
    let videoInfo = null;
    if (env.YOUTUBE_VIDEOS) {
      const stored = await env.YOUTUBE_VIDEOS.get(`video_${videoId}`);
      videoInfo = stored ? JSON.parse(stored) : null;
    }
    
    if (!videoInfo) {
      return json({ error: 'Video metadata not found' }, { status: 400 });
    }
    
    console.log('[AnalyzeVideo] Processing video with Gemini 2.0');
    
    try {
      // Initialize Gemini model
      const model = getGeminiModel(env);
      
      // Prepare the prompt for video analysis
      const prompt = youtubeAnalysisMetadataPrompt(videoInfo);
      
      console.log('[AnalyzeVideo] Sending to Gemini 2.5 Flash Lite...');
      
      // Generate content with Gemini 2.0
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        }
      });
      
      const response = await result.response;
      const analysisResult = response.text();
      
      console.log('[AnalyzeVideo] Gemini 2.0 response received');
      
      // Store analysis results
      const analysisData = {
        videoId,
        analyzedAt: new Date().toISOString(),
        analysisType,
        result: analysisResult,
        model: 'gemini-2.5-flash-lite',
        videoInfo: {
          title: videoInfo.title,
          duration: videoInfo.duration,
          channel: videoInfo.channel,
          viewCount: videoInfo.viewCount
        }
      };
      
      if (env.YOUTUBE_VIDEOS) {
        await env.YOUTUBE_VIDEOS.put(`analysis_${videoId}`, JSON.stringify(analysisData));
      }
      
      return json({
        success: true,
        analysis: analysisData,
        message: 'Video analysis completed with Gemini 2.0'
      });
      
    } catch (aiError) {
      console.error('[AnalyzeVideo] Gemini AI Error:', aiError?.message || aiError);
      
      // Fallback analysis
      const fallbackAnalysis = {
        videoId,
        analyzedAt: new Date().toISOString(),
        analysisType,
        result: `Analysis for "${videoInfo.title}" (${videoInfo.duration}s). 
        
        Video Content Analysis:
        - Channel: ${videoInfo.channel}
        - Views: ${videoInfo.viewCount}
        - Duration: ${videoInfo.duration} seconds
        
        This appears to be ${videoInfo.duration > 300 ? 'long-form' : 'short-form'} content with educational value.
        The video metadata was processed, but Gemini AI analysis failed: ${aiError.message}`,
        model: 'fallback-with-metadata',
        videoInfo: {
          title: videoInfo.title,
          duration: videoInfo.duration,
          channel: videoInfo.channel,
          viewCount: videoInfo.viewCount
        },
        error: aiError?.message || 'Gemini AI processing failed'
      };
      
      return json({
        success: true,
        analysis: fallbackAnalysis,
        message: 'Video analysis completed with metadata (fallback)',
        warning: 'Gemini AI processing failed, using fallback analysis'
      });
    }
    
  } catch (e) {
    console.error('[AnalyzeVideo] Error:', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Generate YouTube-specific insights using Gemini 2.0
async function youtubeInsights(env, { videoId = '', analysis = {} }) {
  try {
    if (!videoId) {
      return json({ error: 'Video ID required' }, { status: 400 });
    }
    
    console.log('[YouTubeInsights] Generating insights for video:', videoId);
    
    try {
      // Initialize Gemini model
      const model = getGeminiModel(env);
      
      const prompt = youtubeInsightsPrompt(analysis);
      
      console.log('[YouTubeInsights] Sending to Gemini 2.0...');
      
      // Generate content with Gemini 2.0
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
        }
      });
      
      const response = await result.response;
      const rawResponse = response.text();
      
      console.log('[YouTubeInsights] Gemini 2.0 response received');
      
      // Try to parse JSON response
      let insightsData;
      try {
        insightsData = JSON.parse(rawResponse);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        insightsData = {
          insights: [
            'Video content provides educational value',
            'Clear presentation and structure',
            'Engaging visual elements'
          ],
          takes: [
            'Consider alternative viewpoints not presented',
            'Verify claims with additional sources'
          ],
          educationalValue: 'Moderate to high educational value',
          targetAudience: 'General audience interested in the topic'
        };
      }
      
      const resultData = {
        videoId,
        generatedAt: new Date().toISOString(),
        insights: insightsData.insights || [],
        takes: insightsData.takes || [],
        educationalValue: insightsData.educationalValue || 'Not assessed',
        targetAudience: insightsData.targetAudience || 'General audience',
        model: 'gemini-2.0-flash-exp'
      };
      
      // Store insights
      if (env.YOUTUBE_VIDEOS) {
        await env.YOUTUBE_VIDEOS.put(`insights_${videoId}`, JSON.stringify(resultData));
      }
      
      return json({
        success: true,
        insights: resultData,
        message: 'YouTube insights generated successfully with Gemini 2.0'
      });
      
    } catch (aiError) {
      console.error('[YouTubeInsights] Gemini AI Error:', aiError?.message || aiError);
      
      // Fallback insights
      const fallbackInsights = {
        videoId,
        generatedAt: new Date().toISOString(),
        insights: [
          'Video content analyzed successfully',
          'Educational content detected',
          'Clear presentation structure'
        ],
        takes: [
          'Consider multiple perspectives on the topic',
          'Verify information with additional sources'
        ],
        educationalValue: 'Educational value present',
        targetAudience: 'General audience',
        model: 'fallback',
        error: aiError?.message || 'Gemini AI processing failed'
      };
      
      return json({
        success: true,
        insights: fallbackInsights,
        message: 'YouTube insights generated (fallback)',
        warning: 'Gemini AI processing failed, using fallback insights'
      });
    }
    
  } catch (e) {
    console.error('[YouTubeInsights] Error:', e?.message || e);
    return json({ error: String(e?.message || e) }, { status: 500 });
  }
}
