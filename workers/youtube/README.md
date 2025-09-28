# ShadowSearch YouTube Worker

This Cloudflare Worker provides YouTube-specific functionality for the ShadowSearch browser extension, including video detection, download simulation, and AI-powered analysis using Gemini 2.5 Flash Lite.

## Features

- **YouTube Detection**: Automatically detects YouTube pages and extracts video IDs
- **Video Download Simulation**: Simulates video download process (local storage for now)
- **AI Video Analysis**: Uses Gemini 2.5 Flash Lite for comprehensive video content analysis
- **YouTube-Specific Insights**: Generates insights and contrarian takes without source videos
- **Cloudflare R2 Integration**: Ready for future video storage implementation

## API Endpoints

### POST /detect-youtube
Detects if the current page is YouTube and extracts video ID.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "isYouTube": true,
  "videoId": "VIDEO_ID",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### POST /download-video
Simulates video download process (currently simulated, ready for R2 integration).

**Request:**
```json
{
  "videoId": "VIDEO_ID",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "success": true,
  "videoInfo": {
    "id": "VIDEO_ID",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "downloadedAt": "2024-01-01T00:00:00.000Z",
    "status": "downloaded",
    "localPath": "/tmp/youtube_VIDEO_ID.mp4"
  },
  "message": "Video download initiated (simulated)"
}
```

### POST /analyze-video
Analyzes video content using Gemini 2.5 Flash Lite.

**Request:**
```json
{
  "videoId": "VIDEO_ID",
  "videoPath": "/tmp/youtube_VIDEO_ID.mp4",
  "analysisType": "comprehensive"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "videoId": "VIDEO_ID",
    "analyzedAt": "2024-01-01T00:00:00.000Z",
    "analysisType": "comprehensive",
    "result": "AI analysis of video content...",
    "model": "gemini-2.0-flash-exp"
  },
  "message": "Video analysis completed"
}
```

### POST /youtube-insights
Generates YouTube-specific insights and contrarian takes.

**Request:**
```json
{
  "videoId": "VIDEO_ID",
  "analysis": {
    "result": "Previous analysis result..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "insights": {
    "videoId": "VIDEO_ID",
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "insights": ["Key insight 1", "Key insight 2"],
    "takes": ["Contrarian take 1", "Contrarian take 2"],
    "educationalValue": "High educational value",
    "targetAudience": "General audience",
    "model": "gemini-2.0-flash-exp"
  },
  "message": "YouTube insights generated successfully"
}
```

## Configuration

### Environment Variables

- `YOUTUBE_API_KEY`: YouTube Data API key for video metadata
- `GEMINI_API_KEY`: Google Gemini API key (if using external API)

### Cloudflare Bindings

- `AI`: Cloudflare AI binding for Gemini 2.5 Flash Lite
- `YOUTUBE_VIDEOS`: KV namespace for storing video metadata and analysis results
- `R2_BUCKET`: R2 bucket for video storage (commented for future implementation)

## Development

### Local Development

```bash
cd workers/youtube
npm install
npm run dev
```

The worker will be available at `http://127.0.0.1:8788`

### Deployment

```bash
npm run deploy
```

## Future Enhancements

### Real Video Download
Currently simulated, but ready for implementation with:
- `ytdl-core` for YouTube video downloading
- `ffmpeg-static` for video processing
- Frame extraction for visual analysis

### Cloudflare R2 Integration
Ready for implementation with commented code:
- Video file storage in R2
- CDN distribution for fast access
- Automatic cleanup of old videos

### Advanced Video Analysis
- Frame-by-frame analysis
- Audio transcription
- Visual content recognition
- Sentiment analysis

## Integration with ShadowSearch Extension

This worker integrates seamlessly with the ShadowSearch browser extension:

1. **Detection**: Content script detects YouTube pages
2. **Analysis**: Background script calls YouTube worker endpoints
3. **Display**: Extension shows YouTube-specific interface without source videos
4. **Storage**: Results stored in Cloudflare KV for persistence

## Error Handling

The worker includes comprehensive error handling:
- Fallback responses when AI services are unavailable
- Graceful degradation for missing video content
- Detailed error logging for debugging

## Security Considerations

- Video downloads are simulated to avoid copyright issues
- No actual video content is stored without proper licensing
- All API calls are rate-limited and authenticated
- User privacy is maintained through local processing

