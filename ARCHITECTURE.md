# ShadowSearch Architecture Diagram

```flowchart TD
  user("🧠 User clicks brain")
  page{YouTube or Regular page?}
  
  %% Regular page flow
  page -->|Regular| regular[📄 Regular Page Analysis]
  regular --> analyze[🤖 AI Analysis]
  analyze --> results1[💡 Insights + Videos]
  
  %% YouTube page flow  
  page -->|YouTube| youtube[📺 YouTube Analysis]
  youtube --> transcript[📝 Get Transcript]
  transcript --> question[❓ Answer Question]
  question --> results2[💡 Answer + Videos]
  
  %% Final output
  results1 --> overlay[🖥️ Show Results]
  results2 --> overlay
  
  %% Services used
  analyze -.->|Uses| ai[🤖 Cloudflare AI]
  question -.->|Uses| ai
  regular -.->|Optional| rag[🔍 RAG Mode]
  rag -.->|Uses| storage[💾 R2 Storage]
  
  %% Styling
  classDef main fill:#E3F2FD,stroke:#1976D2,stroke-width:3px
  classDef youtube fill:#E8F5E8,stroke:#4CAF50,stroke-width:2px
  classDef regular fill:#FFF3E0,stroke:#FF9800,stroke-width:2px
  classDef services fill:#F3E5F5,stroke:#9C27B0,stroke-width:2px
  
  class user,page,overlay main
  class youtube,transcript,question,results2 youtube
  class regular,analyze,results1,rag regular
  class ai,storage services

```

## Simple Flow

**User clicks brain → Extract page content → Send to background → Call Cloudflare Workers → Get AI analysis → Update overlay**

## Key Features

- **🧠 Brain Icon**: Discreet floating button on any webpage
- **📊 Analysis Overlay**: Shows AI insights, related videos, and sources
- **🤖 AI Analysis**: Uses Cloudflare AI (Llama 3.1) for content understanding
- **🔍 Smart Search**: Finds related content across web platforms
- **💬 RAG Q&A**: Ask questions and get answers with sources
- **📺 YouTube Support**: Analyzes video transcripts for insights
- **☁️ Serverless**: Runs entirely on Cloudflare Workers
