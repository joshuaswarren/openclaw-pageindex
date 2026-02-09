/**
 * PageIndex TypeScript - Vectorless, reasoning-based document search
 *
 * MIT License - Copyright (c) 2026 Joshua Warren
 *
 * A TypeScript reimplementation of PageIndex that uses LLM reasoning
 * to traverse hierarchical document trees for precise search results.
 */

import type {
  DocumentNode,
  ParsedDocument,
  SearchQuery,
  SearchResult,
  PageIndexConfig,
  IndexStats,
  LLMProvider,
  LLMClientFunction,
} from "./types.js";
import { parseDocument } from "./parsers.js";
import { searchWithLLM } from "./llm.js";

/**
 * PageIndex class for document indexing and search
 */
export class PageIndex {
  private documents: Map<string, ParsedDocument> = new Map();
  private config: PageIndexConfig;
  private nodes: DocumentNode[] = [];

  constructor(config: PageIndexConfig) {
    this.config = config;
  }

  /**
   * Add a document to the index
   */
  async addDocument(source: string, content?: string): Promise<string> {
    const doc = await parseDocument(source, content);
    this.documents.set(doc.id, doc);
    this.nodes.push(doc.tree);
    return doc.id;
  }

  /**
   * Add multiple documents to the index
   */
  async addDocuments(sources: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const source of sources) {
      const id = await this.addDocument(source);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Remove a document from the index
   */
  removeDocument(id: string): boolean {
    const doc = this.documents.get(id);
    if (doc) {
      this.nodes = this.nodes.filter((n) => n !== doc.tree);
      return this.documents.delete(id);
    }
    return false;
  }

  /**
   * Search documents using LLM reasoning
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const filteredNodes = query.collection
      ? this.nodes.filter((n) =>
          this.documents.get(n.id)?.source.includes(query.collection!)
        )
      : this.nodes;

    return searchWithLLM(
      filteredNodes,
      query,
      this.config.llmProvider,
      this.config.customLLMClient
    );
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): ParsedDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): ParsedDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    let totalNodes = 0;
    let totalChars = 0;

    for (const doc of this.documents.values()) {
      totalNodes += this.countNodes(doc.tree);
      totalChars += doc.metadata.totalChars;
    }

    return {
      totalDocuments: this.documents.size,
      totalNodes,
      totalChars,
      indexSize: JSON.stringify(Array.from(this.documents.entries())).length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear all documents from index
   */
  clear(): void {
    this.documents.clear();
    this.nodes = [];
  }

  /**
   * Save index to file
   */
  async save(filePath: string): Promise<void> {
    const data = Array.from(this.documents.entries());
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(filePath, JSON.stringify(data), "utf-8")
    );
  }

  /**
   * Load index from file
   */
  async load(filePath: string): Promise<void> {
    const content = await import("node:fs/promises").then((fs) =>
      fs.readFile(filePath, "utf-8")
    );
    const data = JSON.parse(content) as [string, ParsedDocument][];

    this.clear();
    for (const [id, doc] of data) {
      this.documents.set(id, doc);
      this.nodes.push(doc.tree);
    }
  }

  /**
   * Count nodes in tree
   */
  private countNodes(node: DocumentNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }
}

// Export types
export type {
  DocumentNode,
  ParsedDocument,
  SearchQuery,
  SearchResult,
  PageIndexConfig,
  IndexStats,
  LLMProvider,
  LLMClientFunction,
};

// Export parsers for advanced usage
export { parseDocument };

// Export LLM search for advanced usage
export { searchWithLLM };
