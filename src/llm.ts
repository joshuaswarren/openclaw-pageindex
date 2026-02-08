/**
 * LLM client for reasoning-based document traversal
 */

import type { DocumentNode, SearchResult, SearchQuery, LLMProvider } from "./types.js";

/**
 * LLM-based search using document tree traversal
 */
export async function searchWithLLM(
  documents: DocumentNode[],
  query: SearchQuery,
  provider: LLMProvider
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Build context from document trees
  const context = buildSearchContext(documents, query);

  // Use LLM to reason about which nodes are relevant
  const prompt = buildSearchPrompt(query.query, context);

  try {
    const response = await callLLM(prompt, provider);
    const relevantIds = parseLLMResponse(response);

    // Build results from relevant nodes
    for (const id of relevantIds) {
      const node = findNodeById(documents, id);
      if (node) {
        results.push({
          content: node.content,
          relevance: 0.8, // LLM-based relevance
          citation: {
            documentId: extractDocumentId(node),
            documentTitle: extractDocumentTitle(node),
            nodeId: node.id,
            section: node.title,
            pageNumber: node.pageNumber,
            position: node.metadata.position,
          },
          excerpt: extractExcerpt(node, 200),
        });
      }
    }
  } catch (error) {
    console.error("LLM search failed:", error);
    // Fall back to simple keyword search
    return fallbackSearch(documents, query);
  }

  return results.slice(0, query.maxResults || 10);
}

/**
 * Build search context from document trees
 */
function buildSearchContext(documents: DocumentNode[], query: SearchQuery): string {
  const parts: string[] = [];

  for (const doc of documents) {
    parts.push(flattenNode(doc, 0));
  }

  return parts.join("\n\n");
}

/**
 * Flatten node tree into text representation
 */
function flattenNode(node: DocumentNode, depth: number): string {
  const indent = "  ".repeat(depth);
  let text = "";

  if (node.title) {
    text += `${indent}${"#".repeat(node.level)} ${node.title}\n`;
  }

  text += `${indent}${node.content.substring(0, 500)}${node.content.length > 500 ? "..." : ""}\n`;

  for (const child of node.children) {
    text += flattenNode(child, depth + 1);
  }

  return text;
}

/**
 * Build search prompt for LLM
 */
function buildSearchPrompt(query: string, context: string): string {
  return `You are a document search assistant. Your task is to find the most relevant sections of documents for a given query.

QUERY: ${query}

DOCUMENT CONTENT:
${context.substring(0, 10000)}${context.length > 10000 ? "..." : ""}

INSTRUCTIONS:
1. Read the query carefully
2. Review the document content above
3. Identify the most relevant sections (nodes) that answer the query
4. Return the node IDs of the most relevant sections, one per line
5. Prioritize sections that directly answer the query over general context

Return ONLY the node IDs, one per line, in order of relevance. Each node ID starts with "node-".`;
}

/**
 * Call LLM API
 */
async function callLLM(prompt: string, provider: LLMProvider): Promise<string> {
  // This will be replaced with actual OpenClaw LLM integration
  // For now, return a mock response
  console.log("[pageindex-ts] LLM call:", {
    provider: provider.name,
    model: provider.model,
    promptLength: prompt.length,
  });

  // TODO: Integrate with OpenClaw's LLM providers
  return "";
}

/**
 * Parse LLM response to extract node IDs
 */
function parseLLMResponse(response: string): string[] {
  const lines = response.split("\n");
  const ids: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("node-")) {
      ids.push(trimmed);
    }
  }

  return ids;
}

/**
 * Find node by ID in tree
 */
function findNodeById(nodes: DocumentNode[], id: string): DocumentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;

    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract document ID from node
 */
function extractDocumentId(node: DocumentNode): string {
  // Extract from node ID or use parent's ID
  return node.id.split("-")[0] || "unknown";
}

/**
 * Extract document title from node
 */
function extractDocumentTitle(node: DocumentNode): string {
  // Walk up the tree to find the root title
  let current: DocumentNode | undefined = node;
  while (current) {
    if (current.type === "root" && current.title) {
      return current.title;
    }
    current = current.children.find((c) => c.id === node.id);
  }
  return "Unknown Document";
}

/**
 * Extract excerpt around node content
 */
function extractExcerpt(node: DocumentNode, maxLength: number): string {
  const content = node.content;
  if (content.length <= maxLength) return content;

  // Try to find a good break point
  const breakPoint = content.lastIndexOf(" ", maxLength);
  return content.substring(0, breakPoint > 0 ? breakPoint : maxLength) + "...";
}

/**
 * Fallback keyword search
 */
function fallbackSearch(documents: DocumentNode[], query: SearchQuery): SearchResult[] {
  const results: SearchResult[] = [];
  const keywords = query.query.toLowerCase().split(/\s+/);

  function searchNodes(nodes: DocumentNode[]): void {
    for (const node of nodes) {
      const contentLower = node.content.toLowerCase();
      const matchCount = keywords.filter((kw) => contentLower.includes(kw)).length;

      if (matchCount > 0) {
        results.push({
          content: node.content,
          relevance: matchCount / keywords.length,
          citation: {
            documentId: extractDocumentId(node),
            documentTitle: extractDocumentTitle(node),
            nodeId: node.id,
            section: node.title,
            pageNumber: node.pageNumber,
            position: node.metadata.position,
          },
          excerpt: extractExcerpt(node, 200),
        });
      }

      if (node.children.length > 0) {
        searchNodes(node.children);
      }
    }
  }

  searchNodes(documents);

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);

  return results.slice(0, query.maxResults || 10);
}
