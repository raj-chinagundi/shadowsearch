# 🧠 ShadowSearch Chrome Extension

A Chrome extension that provides on-demand AI analysis of webpages with contextual insights, RAG-powered search using R2 storage, and related video recommendations.

## ✨ Features

- **Floating Brain Icon** - Discreet, clickable icon on every webpage
- **Dual Analysis Modes**:
  - **Page Analysis** (Lumen OFF) - Analyzes current page content only
  - **RAG Mode** (Lumen ON) - Uses external sources via R2 storage + AI Search
- **Quick Actions** - Summarize, Key Points, ELI5, Concepts
- **Related Videos** - 4 YouTube videos with thumbnails
- **Smart Sources** - Clickable links with real-time content fetching
- **R2 Storage** - Local development with Cloudflare R2 simulation

## 🚀 Quick Setup (5 Minutes!)

### 1. Clone and Install
```bash
git clone <your-repo>
cd cloudfare_main
```

### 2. Get Serper API Key (Required)
1. Go to [Serper.dev](https://serper.dev)
2. Sign up for a free account (100 free searches/month)
3. Get your API key from the dashboard
4. Update `workers/wrangler.toml`:
   ```toml
   [vars]
   SERPER_API_KEY = "your_serper_api_key_here"
   ```

### 3. Start the Worker (Local Development)
```bash
cd workers/api
npm install -g wrangler
wrangler dev --port 8787
```
**That's it!** The worker will run locally with R2 simulation - no Cloudflare account needed for development.

### 4. Load Chrome Extension
1. Open Chrome → **Extensions** → **Developer mode** ON
2. Click **Load unpacked**
3. Select the `src` folder
4. The extension will automatically connect to `http://localhost:8787`

## 🎯 How to Use

1. **Visit any webpage** (e.g., Wikipedia, news sites)
2. **Click the brain icon** in the top-right corner
3. **Toggle Lumen ON/OFF**:
   - **Lumen OFF**: Analyzes current page content only
   - **Lumen ON**: Searches the web and uses RAG for comprehensive answers
4. **Ask questions** or use quick actions (Summarize, Key Points, etc.)
5. **View sources** - Clickable links to original articles
6. **Watch videos** - Related YouTube content with thumbnails

## 🏗️ Architecture

- **Frontend**: Chrome Extension (MV3)
- **Backend**: Cloudflare Workers + AI + R2 Storage
- **Data Sources**: Google Search (Serper API) + YouTube (yt-search)
- **AI Models**: Llama 3.1-8b-instruct + BGE embeddings
- **Storage**: Cloudflare R2 (local simulation for development)

## 🔧 Development

### Local Development (Recommended)
```bash
cd workers/api
wrangler dev --port 8787
```
- **R2 Storage**: Local simulation (fast, free)
- **No Cloudflare Account**: Required for development
- **Hot Reload**: Changes reflect immediately

### Extension Development
1. Make changes to files in `src/`
2. Reload extension in Chrome (Extensions → Reload)
3. Test on any webpage

### Viewing R2 Content
```bash
curl -X POST http://localhost:8787/r2-content -H "Content-Type: application/json" | jq
```

## 📁 Project Structure

```
cloudfare_main/
├── manifest.json              # Chrome extension config
├── src/
│   ├── content/
│   │   ├── content.js         # Brain icon + overlay logic
│   │   └── styles.css         # UI styling
│   ├── background/
│   │   └── background.js      # Service worker + API calls
│   └── options/
│       ├── options.html       # Settings page
│       └── options.js         # Settings logic
├── workers/
│   ├── wrangler.toml          # Cloudflare config (with SERPER_API_KEY)
│   └── api/src/
│       └── index.js           # Main worker with R2-based RAG
└── google_search.js           # Content extraction utilities
```

## 🎯 How It Works

1. **User clicks brain icon** → Overlay opens
2. **Page Analysis Mode** → Analyzes current page content only
3. **RAG Mode** → 
   - Searches Google via Serper API
   - Extracts content from articles
   - Stores in R2 bucket (local simulation)
   - Uses LLM to generate answers from stored content
4. **AI generates insights** → Displays with sources and videos

## 🔑 Required APIs

- **Serper API** - For fetching Google search results (100 free/month)
- **Cloudflare Workers AI** - For LLM and embeddings (free tier available)
- **R2 Storage** - Local simulation for development (no account needed)

## 🐛 Troubleshooting

### Common Issues

**Extension not loading:**
- Check Chrome Developer mode is ON
- Reload extension after changes
- Check browser console for errors

**No search results:**
- Verify SERPER_API_KEY in `workers/wrangler.toml`
- Check Serper API quota (100 free searches/month)
- Restart worker: `wrangler dev --port 8787`

**Worker not starting:**
- Check if port 8787 is available: `lsof -ti:8787`
- Kill existing processes: `pkill -f wrangler`
- Restart: `cd workers/api && wrangler dev --port 8787`

**No sources showing:**
- Check R2 content: `curl -X POST http://localhost:8787/r2-content`
- Verify content extraction is working
- Check browser console for API errors

### Debug Commands

```bash
# Check worker status
curl http://localhost:8787/health

# View R2 content
curl -X POST http://localhost:8787/r2-content -H "Content-Type: application/json" | jq

# Test QA endpoint
curl -X POST http://localhost:8787/qa -H "Content-Type: application/json" \
  -d '{"query": "test", "topic": "test", "sessionId": "test"}'
```

## 📄 License

MIT License - Feel free to use for your hackathon projects!