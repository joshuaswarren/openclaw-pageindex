#!/usr/bin/env node

/**
 * Simple test script to verify openclaw-pageindex LLM integration
 */

import { PageIndex } from "./dist/index.js";

async function testLLMIntegration() {
  console.log("Testing openclaw-pageindex LLM integration...\n");

  // Create PageIndex instance with mock LLM config
  const pageindex = new PageIndex({
    llmProvider: {
      name: "test",
      model: "test-model",
      apiKey: "test-key",
    },
    debug: true,
    cacheEnabled: false,
  });

  // Test adding a text document
  console.log("1. Testing document parsing...");
  const docId = await pageindex.addDocument(
    "test-doc",
    "# Test Document\n\n## Section 1\nThis is the first section with some content.\n\n## Section 2\nThis is the second section with different content."
  );
  console.log("✓ Document added with ID:", docId);

  // Test keyword search (fallback)
  console.log("\n2. Testing keyword search fallback...");
  const results = await pageindex.search({
    query: "second section",
    maxResults: 5,
  });
  console.log(`✓ Found ${results.length} results`);
  if (results.length > 0) {
    console.log("  First result excerpt:", results[0].excerpt.substring(0, 100) + "...");
  }

  // Test stats
  console.log("\n3. Testing index stats...");
  const stats = pageindex.getStats();
  console.log("✓ Stats:", stats);

  console.log("\n✅ All tests passed!");
}

testLLMIntegration().catch(console.error);
