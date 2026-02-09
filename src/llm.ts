/**
 * LLM client for OpenClaw integration
 */

import type { DocumentNode, SearchResult, SearchQuery, LLMProvider } from "./types.js";

/**
 * OpenClaw LLM provider interface
 */
interface OpenClawLLMProvider {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  api?: "anthropic-messages" | "openai-completions" | "google-generative-ai";
}

/**
 * Custom LLM client function type
 * Takes a prompt string and returns the LLM response
 */
export type LLMClientFunction = (prompt: string) => Promise<string>;

/**
 * LLM-based search using document tree traversal with OpenClaw integration
 */
export async function searchWithLLM(
  documents: DocumentNode[],
  query: SearchQuery,
  provider: OpenClawLLMProvider,
  customLLMClient?: LLMClientFunction
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Build context from document trees
  const context = buildSearchContext(documents, query);

  // Use LLM to reason about which nodes are relevant
  const prompt = buildSearchPrompt(query.query, context);

  try {
    const response = await callOpenClawLLM(prompt, provider, customLLMClient);
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
 * Build search context from document trees with node IDs
 */
function buildSearchContext(documents: DocumentNode[], query: SearchQuery): string {
  const parts: string[] = [];

  for (const doc of documents) {
    parts.push(flattenNode(doc, 0));
  }

  return parts.join("\n\n");
}

/**
 * Flatten node tree into text representation with node IDs
 */
function flattenNode(node: DocumentNode, depth: number): string {
  const indent = "  ".repeat(depth);
  let text = "";

  // Add node ID for LLM reference
  text += `${indent}[ID: ${node.id}]`;

  if (node.title) {
    text += ` ${"#".repeat(node.level)} ${node.title}\n`;
  } else {
    text += "\n";
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
  return `You are a document search assistant for OpenClaw. Your task is to find the most relevant sections of documents for a given query.

QUERY: ${query}

DOCUMENT CONTENT:
${context.substring(0, 15000)}${context.length > 15000 ? "...\n\n[Content truncated for brevity]" : ""}

INSTRUCTIONS:
1. Read the query carefully
2. Review the document content above
3. Identify the most relevant sections that answer the query
4. Return the node IDs of the most relevant sections, one per line
5. Each node ID is marked with [ID: node-...] in the content
6. Prioritize sections that directly answer the query
7. Return ONLY node IDs, one per line, in order of relevance

Format: Return one node ID per line, starting with "node-"`;
}

/**
 * Call OpenClaw LLM API
 */
async function callOpenClawLLM(
  prompt: string,
  provider: OpenClawLLMProvider,
  customLLMClient?: LLMClientFunction
): Promise<string> {
  // If custom LLM client is provided, use it
  if (customLLMClient) {
    console.log("[openclaw-pageindex] Using custom LLM client:", {
      provider: provider.name,
      model: provider.model,
      promptLength: prompt.length,
    });
    return await customLLMClient(prompt);
  }

  // Otherwise use direct API calls
  const { apiKey, baseUrl, model, api = "anthropic-messages" } = provider;

  if (!apiKey) {
    throw new Error("LLM provider requires apiKey");
  }

  console.log("[openclaw-pageindex] LLM call:", {
    provider: provider.name,
    model,
    api,
    promptLength: prompt.length,
  });

  // Call based on API type
  if (api === "anthropic-messages") {
    return await callAnthropic(prompt, apiKey, baseUrl, model);
  } else if (api === "openai-completions") {
    return await callOpenAI(prompt, apiKey, baseUrl, model);
  } else if (api === "google-generative-ai") {
    return await callGoogle(prompt, apiKey, model);
  } else {
    throw new Error(`Unsupported API type: ${api}`);
  }
}

/**
 * Call Anthropic Messages API (Claude)
 */
async function callAnthropic(
  prompt: string,
  apiKey: string,
  baseUrl?: string,
  model = "claude-3-5-sonnet-20241022"
): Promise<string> {
  const url = baseUrl || "https://api.anthropic.com/v1/messages";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || data.completion || "";
}

/**
 * Call OpenAI Completions API
 */
async function callOpenAI(
  prompt: string,
  apiKey: string,
  baseUrl?: string,
  model = "gpt-4"
): Promise<string> {
  const url = baseUrl || "https://api.openai.com/v1/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      max_tokens: 2048,
      temperature: 0.0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.text?.trim() || "";
}

/**
 * Call Google Generative AI API
 */
async function callGoogle(
  prompt: string,
  apiKey: string,
  model = "gemini-2.5-flash"
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
  const parts = node.id.split("-");
  return parts[0] || "unknown";
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
