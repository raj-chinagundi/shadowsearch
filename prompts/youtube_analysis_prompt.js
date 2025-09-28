// Prompt for analyzing YouTube videos
export const youtubeAnalysisPrompt = (videoInfo) => {
  return `Please analyze this YouTube video and provide:
1. Main topics and themes
2. Key insights and takeaways
3. Visual elements that stand out
4. Educational value
5. Target audience
6. Overall quality assessment

Video Details:
- Title: ${videoInfo.title}
- Duration: ${videoInfo.duration} seconds
- Channel: ${videoInfo.channel}
- View Count: ${videoInfo.viewCount}
- Description: ${videoInfo.description?.slice(0, 500) || 'No description available'}

Please provide a comprehensive analysis based on the video content.`;
};

// Alternative prompt for metadata-based analysis
export const youtubeAnalysisMetadataPrompt = (videoInfo) => {
  return `Please analyze this YouTube video and provide:
1. Main topics and themes
2. Key insights and takeaways
3. Visual elements that stand out
4. Educational value
5. Target audience
6. Overall quality assessment

Video Details:
- Title: ${videoInfo.title}
- Duration: ${videoInfo.duration} seconds (${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60).toString().padStart(2, '0')})
- Channel: ${videoInfo.channel}
- View Count: ${videoInfo.viewCount.toLocaleString()}
- Published: ${videoInfo.publishedAt ? new Date(videoInfo.publishedAt).toLocaleDateString() : 'Unknown'}
- Tags: ${videoInfo.tags ? videoInfo.tags.slice(0, 5).join(', ') : 'None'}
- Description: ${videoInfo.description?.slice(0, 1000) || 'No description available'}
- Video URL: ${videoInfo.url}
- Thumbnail: ${videoInfo.thumbnail}

Please provide a comprehensive analysis based on the video metadata and content. Since this is a YouTube video, consider the typical content structure, educational value, and target audience.`;
};
