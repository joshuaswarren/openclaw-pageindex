# OpenClaw PageIndex (openclaw-pageindex)

**Vectorless, reasoning-based document search using OpenClaw's LLM providers.**

A native TypeScript implementation of [PageIndex](https://pageindex.ai)'s hierarchical document tree traversal, designed for OpenClaw integration.

## ✨ Features

- 🧠 **LLM-based search** — Uses language models to reason about document relevance
- 🌳 **Hierarchical trees** — Preserves document structure for better context
- 📚 **Multiple formats** — Supports PDF, Markdown, HTML, and plain text
- 🎯 **Precise citations** — Returns exact page numbers and section references
- ⚡ **Fast & lightweight** — No vector embeddings required
- 🔌 **Multi-provider support** — Anthropic, OpenAI, Google, and OpenClaw
- 📦 **Type-safe** — Full TypeScript support
- 🔄 **Fallback strategy** — Keyword search when LLM fails
- 🏠 **Custom LLM client** — Use local LLMs (Ollama, vLLM, LM Studio) with any provider

## 🚀 Quick Start

```bash
npm install openclaw-pageindex
```

```typescript
import { PageIndex } from "openclaw-pageindex";

// Create index with LLM configuration
const index = new PageIndex({
  llmProvider: {
    name: "openclaw", // Uses OpenClaw's configured LLM
    model: "claude-opus-4-6",
  },
  cacheEnabled: true,
});

// Add documents
await index.addDocument("./report.pdf");
await index.addDocument("./docs.md");

// Search
const results = await index.search({
  query: "What are the key findings?",
  maxResults: 5,
});

// Display results with citations
for (const result of results) {
  console.log(`Found in: ${result.citation.documentTitle}`);
  console.log(`Page: ${result.citation.pageNumber}`);
  console.log(`Relevance: ${result.relevance}`);
  console.log(`Content: ${result.excerpt}\n`);
}
```

## 📖 How It Works

### Traditional RAG vs. PageIndex

**Traditional RAG:**
- Chunk documents → Vector embeddings → Vector search → Retrieve chunks
- Loses document structure and context
- Requires expensive vector database

**PageIndex:**
- Parse documents → Hierarchical trees → LLM reasoning → Relevant sections
- Preserves document structure and context
- No embeddings or vector database needed

### Document Parsing

PageIndex parses documents into hierarchical trees:

```
Document (root)
├─ Section 1 (h1)
│  ├─ Subsection 1.1 (h2)
│  │  └─ Paragraph
│  └─ Subsection 1.2 (h2)
│     └─ Paragraph
└─ Section 2 (h1)
   └─ Paragraph
```

### LLM-Based Search

1. **Build context** from document trees
2. **Send query and context** to LLM
3. **LLM reasons** about which sections are relevant
4. **Return precise citations** with page numbers and positions

## 🔧 Configuration

```typescript
const index = new PageIndex({
  llmProvider: {
    name: "anthropic" | "openai" | "google" | "openclaw",
    apiKey: "your-api-key", // Required for Anthropic, OpenAI, Google
    baseUrl: "https://api.example.com", // Optional custom endpoint
    model: "gpt-4" | "claude-opus-4-6" | "gemini-2.5-flash",
    api: "anthropic-messages" | "openai-completions" | "google-generative-ai",
  },
  cacheEnabled: true, // Enable result caching
  cacheSize: 100, // Number of cached results
  debug: false, // Enable debug logging
});
```

### LLM Providers

**Anthropic (Claude):**
```typescript
{
  name: "anthropic",
  model: "claude-opus-4-6",
  apiKey: process.env.ANTHROPIC_API_KEY,
  api: "anthropic-messages",
}
```

**OpenAI:**
```typescript
{
  name: "openai",
  model: "gpt-4",
  apiKey: process.env.OPENAI_API_KEY,
  api: "openai-completions",
}
```

**Google (Gemini):**
```typescript
{
  name: "google",
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  api: "google-generative-ai",
}
```

**OpenClaw (Recommended):**
```typescript
{
  name: "openclaw",
  model: "claude-opus-4-6", // Uses OpenClaw's configured model
}
```

## 🏠 Custom LLM Client

PageIndex supports custom LLM clients for local or specialized models:

```typescript
import { PageIndex } from "openclaw-pageindex";

// Define your custom LLM client
const myLocalLLM = async (prompt: string): Promise<string> => {
  const response = await fetch("http://localhost:1234/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3-coder-30b-a3b-instruct-mlx@8bit",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000
    })
  });
  const data = await response.json();
  return data.choices[0].message.content;
};

// Use with PageIndex
const index = new PageIndex({
  llmProvider: {
    name: "local-vllm",
    model: "qwen3-coder-30b-a3b-instruct-mlx@8bit",
  },
  customLLMClient: myLocalLLM, // Your custom function
  cacheEnabled: true,
});
```

**Use Cases:**
- **Local LLMs** — Ollama, vLLM, LM Studio, MLX
- **Specialized models** — Fine-tuned domain-specific models
- **Cost optimization** — Use smaller local models for simple queries
- **Privacy** — Keep document processing on-premise
- **Hybrid approach** — Local LLM with cloud fallback

**Fallback Behavior:**
When `customLLMClient` is provided, PageIndex uses it for all search operations. If the custom client fails, PageIndex automatically falls back to keyword search.

## 📚 Supported Document Types

| Format | Extension | Features |
|--------|-----------|----------|
| PDF | `.pdf` | Page numbers, text extraction |
| Markdown | `.md`, `.markdown` | Heading hierarchy, code blocks |
| HTML | `.html`, `.htm` | Heading detection, text extraction |
| Plain Text | `.txt` | Paragraph detection |

## 🎯 Search API

```typescript
const results = await index.search({
  query: "search query",
  maxResults: 10, // Default: 10
  threshold: 0.5, // Relevance threshold 0-1 (optional)
  collection: "docs", // Filter by collection (optional)
});
```

### Search Result Structure

```typescript
{
  content: "Full content of the matching section",
  relevance: 0.95, // 0-1 relevance score
  citation: {
    documentId: "doc-123",
    documentTitle: "Annual Report 2024",
    nodeId: "node-456",
    section: "Financial Summary",
    pageNumber: 12,
    position: 3450
  },
  excerpt: "Brief excerpt around the match..."
}
```

## 📊 Index Management

```typescript
// Get statistics
const stats = index.getStats();
console.log(`Documents: ${stats.totalDocuments}`);
console.log(`Nodes: ${stats.totalNodes}`);
console.log(`Size: ${stats.indexSize} bytes`);

// Save index to disk
await index.save("./index.json");

// Load index from disk
await index.load("./index.json");

// Clear all documents
index.clear();

// Remove specific document
index.removeDocument("doc-id");

// Get all documents
const docs = index.getAllDocuments();

// Get specific document
const doc = index.getDocument("doc-id");
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - Copyright (c) 2026 Joshua Warren

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [PageIndex](https://github.com/VectifyAI/PageIndex) - Original Python implementation
- [pdf-parse](https://github.com/mozilla/pdf.js) - PDF parsing
- [cheerio](https://github.com/cheeriojs/cheerio) - HTML parsing

## 🔗 Links

- **GitHub**: https://github.com/joshuaswarren/openclaw-pageindex
- **NPM**: https://www.npmjs.com/package/openclaw-pageindex
- **Issues**: https://github.com/joshuaswarren/openclaw-pageindex/issues

---

**Happy searching!** 🔍📚
