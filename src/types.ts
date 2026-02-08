/**
 * Core types for PageIndex TypeScript implementation
 */

/**
 * Document node in the hierarchical tree
 */
export interface DocumentNode {
  id: string;
  type: "root" | "section" | "subsection" | "paragraph" | "list" | "code";
  title?: string;
  content: string;
  level: number;
  pageNumber?: number;
  children: DocumentNode[];
  metadata: {
    charCount: number;
    wordCount: number;
    position: number; // Position in the document
  };
}

/**
 * Parsed document with its tree structure
 */
export interface ParsedDocument {
  id: string;
  source: string; // File path or URL
  title: string;
  author?: string;
  createdAt: Date;
  type: "pdf" | "markdown" | "html" | "text";
  tree: DocumentNode;
  metadata: {
    totalPages?: number;
    totalChars: number;
    totalWords: number;
    language?: string;
  };
}

/**
 * Search query with options
 */
export interface SearchQuery {
  query: string;
  maxResults?: number;
  threshold?: number; // Relevance threshold 0-1
  collection?: string;
}

/**
 * Search result with citation
 */
export interface SearchResult {
  content: string;
  relevance: number;
  citation: {
    documentId: string;
    documentTitle: string;
    nodeId: string;
    section?: string;
    pageNumber?: number;
    position: number;
  };
  excerpt: string; // Surrounding context
}

/**
 * LLM provider configuration
 */
export interface LLMProvider {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * PageIndex configuration
 */
export interface PageIndexConfig {
  llmProvider: LLMProvider;
  cacheEnabled?: boolean;
  cacheSize?: number;
  indexPath?: string;
  debug?: boolean;
}

/**
 * Index statistics
 */
export interface IndexStats {
  totalDocuments: number;
  totalNodes: number;
  totalChars: number;
  indexSize: number;
  lastUpdated: Date;
}
