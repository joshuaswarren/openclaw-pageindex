# PageIndex TypeScript (pageindex-ts)

**Vectorless, reasoning-based document search using LLM traversal of hierarchical document trees.**

A TypeScript reimplementation of [PageIndex](https://github.com/VectifyAI/PageIndex), providing a modern, type-safe alternative for Node.js applications.

## ✨ Features

- 🧠 **LLM-based search** — Uses language models to reason about document relevance
- 🌳 **Hierarchical trees** — Preserves document structure for better context
- 📚 **Multiple formats** — Supports PDF, Markdown, HTML, and plain text
- 🎯 **Precise citations** — Returns exact page numbers and section references
- ⚡ **Fast & lightweight** — No vector embeddings required
- 🔌 **Easy integration** — Works with any LLM provider
- 📦 **Type-safe** — Full TypeScript support
- 🔄 **Persistent index** — Save and load indexes from disk

## 🚀 Quick Start

```bash
npm install pageindex-ts
```

```typescript
import { PageIndex } from "pageindex-ts";

// Create index with LLM configuration
const index = new PageIndex({
  llmProvider: {
    name: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4",
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
    name: "openai" | "anthropic" | "custom",
    apiKey: "your-api-key",
    baseUrl: "https://api.example.com", // Optional for custom providers
    model: "gpt-4" | "claude-3-opus" | "custom-model",
    maxTokens: 4096,
    temperature: 0.0, // Lower for more deterministic search
  },
  cacheEnabled: true, // Enable result caching
  cacheSize: 100, // Number of cached results
  indexPath: "./pageindex-cache", // Path for persistent storage
  debug: false, // Enable debug logging
});
```

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

- **GitHub**: https://github.com/joshuaswarren/pageindex-ts
- **NPM**: https://www.npmjs.com/package/pageindex-ts
- **Issues**: https://github.com/joshuaswarren/pageindex-ts/issues

---

**Happy searching!** 🔍📚
