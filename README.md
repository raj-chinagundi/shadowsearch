# ShadowSearch - AI-Powered Browser Extension

A Chrome extension that provides intelligent page analysis, contextual search, and AI-powered insights directly in your browser. Built with Cloudflare Workers for scalable AI processing and R2 storage for session management.

## UI
<img src="https://pasteboard.co/u8xPlEqLKntn.png" alt="UI Preview" width="500"/>

## 🚀 Features

- **Smart Page Analysis**: AI-powered topic extraction and entity recognition
- **Contextual Search**: Intelligent search across Reddit, HackerNews, ArXiv, and YouTube
- **RAG-Powered Q&A**: Ask questions and get answers backed by real-time web content
- **Session Management**: Clean R2 storage with per-tab, per-mode session isolation
- **YouTube Integration**: Video analysis and related content discovery
- **Real-time Insights**: AI-generated insights and critical perspectives

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chrome        │    │  Cloudflare      │    │   External      │
│   Extension     │◄──►│  Workers API     │◄──►│   Services      │
│                 │    │                  │    │                 │
│ • Content Script│    │ • /analyzer      │    │ • Serper API    │
│ • Background    │    │ • /search        │    │ • YouTube       │
│ • Options       │    │ • /qa (RAG)      │    │ • AI Models     │
│                 │    │ • /insights      │    │                 │
└─────────────────┘    │ • /clear-session │    └─────────────────┘
                       │ • R2 Storage     │
                       │ • AI Models      │
                       └──────────────────┘
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+
- Chrome browser
- Cloudflare account
- Serper API key (for search functionality)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd cloudfare_main
npm install
```

### 2. Deploy Cloudflare Workers

```bash
# Navigate to API worker
cd workers/api

# Login to Cloudflare (if not already)
wrangler login

# Deploy the API worker
wrangler deploy
```

The worker will be available at: `https://shadowsearch-api.your-username.workers.dev`

### 3. Configure Environment Variables

GET YOUR SERPER KEY FROM HERE [Serper.dev](https://serper.dev/) <br>
Set your Serper API key as a secret:

```bash
cd workers/api
wrangler secret put SERPER_API_KEY
# Enter your Serper API key when prompted
```

### 4. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `cloudfare_main` folder
4. The ShadowSearch extension should now appear in your extensions

### 5. Configure API Key (Optional)

1. Click the ShadowSearch extension icon
2. Go to Options
3. Enter your Serper API key for enhanced search functionality

## 📡 API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyzer` | POST | Analyze page content and extract topics/entities |
| `/search` | POST | Search across platforms and find related videos |
| `/insights` | POST | Generate AI-powered insights and critical takes |
| `/qa` | POST | RAG-powered question answering with sources |
| `/analyze_question` | POST | Analyze specific questions about page content |

### Session Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/clear-session` | POST | Clear R2 storage for a specific session |
| `/r2-content` | POST | View stored content in R2 bucket |

### Example API Usage

```javascript
// Analyze a page
const response = await fetch('https://shadowsearch-api.your-username.workers.dev/analyzer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: "Page Title",
    url: "https://example.com",
    text: "Page content..."
  })
});

// Ask a question with RAG
const qaResponse = await fetch('https://shadowsearch-api.your-username.workers.dev/qa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "What is machine learning?",
    topic: "AI",
    sessionId: "session_123"
  })
});
```

## 🗄️ R2 Session Management

The extension uses intelligent session management to prevent R2 storage bloat:

### Session Model
- **Per-tab isolation**: Each browser tab gets its own session
- **Per-mode isolation**: Lumen ON/OFF modes have separate sessions
- **Session persistence**: Same session used across multiple queries in the same tab/mode
- **Automatic cleanup**: Sessions cleared when tab closes or mode switches

### Session Lifecycle
1. **Tab opens**: Creates fresh sessions for both modes
2. **Mode toggle**: Clears old mode session, creates new one
3. **Multiple queries**: Uses same session (content accumulates)
4. **Tab closes**: Clears both mode sessions from R2

### Session ID Format
```
session_{tabId}_{mode}_{timestamp}
- tabId: Chrome tab ID
- mode: "off" or "on" (Lumen mode)
- timestamp: Creation time
```

## 🔧 Development

### Local Development

```bash
# Start local API worker
cd workers/api
wrangler dev

# Extension will use localhost:8787 for API calls
```

### Testing Endpoints

```bash
# Test analyzer
curl -X POST https://shadowsearch-api.your-username.workers.dev/analyzer \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","url":"https://example.com","text":"AI content"}'

# Test RAG QA
curl -X POST https://shadowsearch-api.your-username.workers.dev/qa \
  -H "Content-Type: application/json" \
  -d '{"query":"What is AI?","topic":"AI","sessionId":"test_session"}'

# Clear session
curl -X POST https://shadowsearch-api.your-username.workers.dev/clear-session \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test_session"}'
```

## 📁 Project Structure

```
cloudfare_main/
├── src/
│   ├── background/          # Service worker
│   ├── content/            # Content script
│   └── options/            # Extension options
├── workers/
│   └── api/                # Cloudflare Worker
│       ├── src/index.js    # Main worker code
│       └── wrangler.toml   # Worker config
├── prompts/                # AI prompt templates
├── icons/                  # Extension icons
└── manifest.json           # Extension manifest
```

## 🔑 Environment Variables

### Required
- `SERPER_API_KEY`: Your Serper API key for search functionality

## 🚀 Deployment

### Cloudflare Workers
```bash
cd workers/api
wrangler deploy
```

### Chrome Extension
1. Load unpacked extension in Chrome
2. Or package as `.crx` for distribution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

**Extension not working:**
- Check if Cloudflare Worker is deployed
- Verify API endpoints are accessible
- Check browser console for errors

**RAG not returning results:**
- Verify Serper API key [link](serper.dev) is set
- Check R2 bucket permissions
- Ensure session management is working

**YouTube videos not loading:**
- Check YouTube worker is running locally
- Verify network connectivity
- Check for CORS issues

### Debug Mode

Enable debug logging by opening Chrome DevTools and checking the console for detailed logs.

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ using Cloudflare AI Workers**
```
