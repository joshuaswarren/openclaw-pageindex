/**
 * Document parsers for various file types
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import pdf from "pdf-parse";
import * as cheerio from "cheerio";
import type { DocumentNode, ParsedDocument } from "./types.js";

interface PartialParsedDocument {
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
 * Parse a document from file path or content
 */
export async function parseDocument(
  source: string,
  content?: string
): Promise<ParsedDocument> {
  const ext = content ? "text" : path.extname(source).toLowerCase();
  const filename = path.basename(source);

  let docContent = content;
  if (!docContent) {
    docContent = await fs.readFile(source, "utf-8");
  }

  let partial: PartialParsedDocument;

  switch (ext) {
    case ".pdf":
      partial = await parsePDF(source);
      break;
    case ".md":
    case ".markdown":
      partial = parseMarkdown(source, docContent);
      break;
    case ".html":
    case ".htm":
      partial = parseHTML(source, docContent);
      break;
    case ".txt":
    default:
      partial = parseText(source, docContent);
      break;
  }

  return {
    id: generateId(source),
    source,
    title: partial.tree.title || filename,
    createdAt: new Date(),
    type: partial.type,
    tree: partial.tree,
    metadata: partial.metadata,
  };
}

/**
 * Parse PDF document with improved page and chapter detection
 */
async function parsePDF(filePath: string): Promise<PartialParsedDocument> {
  const buffer = await fs.readFile(filePath);
  const data = await pdf(buffer);

  const tree: DocumentNode = {
    id: "root",
    type: "root",
    content: data.text,
    level: 0,
    children: [],
    metadata: {
      charCount: data.text.length,
      wordCount: data.text.split(/\s+/).length,
      position: 0,
    },
  };

  // Try multiple strategies to split PDF into pages
  let pageTexts: string[] = [];

  // Strategy 1: Form feed characters
  if (data.text.includes("\f")) {
    pageTexts = data.text.split(/\f/);
  }
  // Strategy 2: Use pdf-parse's numpages to estimate page boundaries
  else if (data.numpages && data.numpages > 1) {
    const avgCharsPerPage = Math.floor(data.text.length / data.numpages);
    for (let i = 0; i < data.numpages; i++) {
      const start = i * avgCharsPerPage;
      const end = (i + 1) * avgCharsPerPage;
      pageTexts.push(data.text.substring(start, end));
    }
  }
  // Strategy 3: Try to detect chapter headings as natural breaks
  else {
    // Split by common chapter patterns
    const chapterPatterns = [
      /\n\s*CHAPTER\s+[IVXLCDM]+\n/gi,
      /\n\s*Chapter\s+\d+\n/gi,
      /\n\s*#\s+[A-Z][A-Z\s]+\n/g,
      /\n\s*Part\s+[IVXLCDM]+\n/gi,
    ];

    let splits = [data.text];
    for (const pattern of chapterPatterns) {
      const newSplits: string[] = [];
      for (const split of splits) {
        const parts = split.split(pattern);
        newSplits.push(...parts);
      }
      if (newSplits.length > splits.length) {
        splits = newSplits;
        break; // Use the first pattern that works
      }
    }
    pageTexts = splits;
  }

  // If still only one page, split by paragraphs (every 5000 chars ≈ 2-3 pages)
  if (pageTexts.length === 1 && pageTexts[0].length > 5000) {
    pageTexts = [];
    let current = "";
    let position = 0;
    const lines = data.text.split("\n");
    let currentSectionChars = 0;
    const charsPerSection = 5000; // Approx 2-3 pages per section

    for (const line of lines) {
      current += line + "\n";
      currentSectionChars += line.length + 1;

      if (currentSectionChars >= charsPerSection) {
        pageTexts.push(current.trim());
        current = "";
        currentSectionChars = 0;
      }
    }
    if (current.trim()) {
      pageTexts.push(current.trim());
    }
  }

  // Create page/section nodes
  let position = 0;
  pageTexts.forEach((pageText: string, index: number) => {
    if (pageText.trim().length === 0) return;

    // Try to detect a heading/title from the first few lines
    const lines = pageText.trim().split("\n").slice(0, 5);
    let title = `Section ${index + 1}`;

    // Look for all-caps headings or numbered patterns
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 100 &&
          (trimmed === trimmed.toUpperCase() ||
           /^(CHAPTER|Chapter|Part|#|\d+\.)\s+/.test(trimmed))) {
        title = trimmed;
        break;
      }
    }

    const sectionNode: DocumentNode = {
      id: `section-${index + 1}`,
      type: "section",
      title,
      content: pageText.trim(),
      level: 1,
      pageNumber: index + 1,
      children: [],
      metadata: {
        charCount: pageText.length,
        wordCount: pageText.split(/\s+/).length,
        position,
      },
    };

    tree.children.push(sectionNode);
    position += pageText.length;
  });

  return {
    type: "pdf",
    tree,
    metadata: {
      totalPages: data.numpages || pageTexts.length,
      totalChars: data.text.length,
      totalWords: data.text.split(/\s+/).length,
    },
  };
}

/**
 * Parse Markdown document
 */
function parseMarkdown(
  source: string,
  content: string
): PartialParsedDocument {
  const lines = content.split("\n");
  const root: DocumentNode = {
    id: "root",
    type: "root",
    content,
    level: 0,
    children: [],
    metadata: {
      charCount: content.length,
      wordCount: content.split(/\s+/).length,
      position: 0,
    },
  };

  const stack: { node: DocumentNode; level: number }[] = [{ node: root, level: 0 }];
  let currentContent = "";
  let position = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      // Save accumulated content
      if (currentContent.trim()) {
        const contentNode: DocumentNode = {
          id: generateId(`content-${position}`),
          type: "paragraph",
          content: currentContent.trim(),
          level: stack[stack.length - 1].level + 1,
          children: [],
          metadata: {
            charCount: currentContent.length,
            wordCount: currentContent.split(/\s+/).length,
            position,
          },
        };
        stack[stack.length - 1].node.children.push(contentNode);
        position += currentContent.length;
        currentContent = "";
      }

      // Pop stack until we find the parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const headingNode: DocumentNode = {
        id: generateId(`heading-${position}`),
        type: "section",
        title,
        content: line,
        level,
        children: [],
        metadata: {
          charCount: line.length,
          wordCount: line.split(/\s+/).length,
          position,
        },
      };

      stack[stack.length - 1].node.children.push(headingNode);
      stack.push({ node: headingNode, level });
      position += line.length + 1;
    } else {
      currentContent += line + "\n";
    }
  }

  // Save remaining content
  if (currentContent.trim()) {
    const contentNode: DocumentNode = {
      id: generateId(`content-${position}`),
      type: "paragraph",
      content: currentContent.trim(),
      level: stack[stack.length - 1].level + 1,
      children: [],
      metadata: {
        charCount: currentContent.length,
        wordCount: currentContent.split(/\s+/).length,
        position,
      },
    };
    stack[stack.length - 1].node.children.push(contentNode);
  }

  return {
    type: "markdown",
    tree: root,
    metadata: {
      totalChars: content.length,
      totalWords: content.split(/\s+/).length,
    },
  };
}

/**
 * Parse HTML document
 */
function parseHTML(source: string, content: string): PartialParsedDocument {
  const $ = cheerio.load(content);
  const root: DocumentNode = {
    id: "root",
    type: "root",
    content: $.text(),
    level: 0,
    children: [],
    metadata: {
      charCount: $.text().length,
      wordCount: $.text().split(/\s+/).length,
      position: 0,
    },
  };

  let position = 0;

  // Extract headings and content
  const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
  const stack: { node: DocumentNode; level: number }[] = [{ node: root, level: 0 }];

  $("body").find("*").each((_idx: number, element: any) => {
    const tagName = element.tagName?.toLowerCase();
    const text = $(element).text().trim();

    if (!text) return;

    if (headings.includes(tagName)) {
      const level = parseInt(tagName.charAt(1));

      // Pop stack until we find the parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const headingNode: DocumentNode = {
        id: generateId(`heading-${position}`),
        type: "section",
        title: text,
        content: text,
        level,
        children: [],
        metadata: {
          charCount: text.length,
          wordCount: text.split(/\s+/).length,
          position,
        },
      };

      stack[stack.length - 1].node.children.push(headingNode);
      stack.push({ node: headingNode, level });
      position += text.length;
    } else if (tagName === "p" || tagName === "div") {
      const pNode: DocumentNode = {
        id: generateId(`content-${position}`),
        type: "paragraph",
        content: text,
        level: stack[stack.length - 1].level + 1,
        children: [],
        metadata: {
          charCount: text.length,
          wordCount: text.split(/\s+/).length,
          position,
        },
      };

      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(pNode);
      }
      position += text.length;
    }
  });

  return {
    type: "html",
    tree: root,
    metadata: {
      totalChars: $.text().length,
      totalWords: $.text().split(/\s+/).length,
    },
  };
}

/**
 * Parse plain text document
 */
function parseText(source: string, content: string): PartialParsedDocument {
  const lines = content.split("\n");
  const root: DocumentNode = {
    id: "root",
    type: "root",
    content,
    level: 0,
    children: [],
    metadata: {
      charCount: content.length,
      wordCount: content.split(/\s+/).length,
      position: 0,
    },
  };

  let position = 0;
  let currentParagraph = "";

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentParagraph.trim()) {
        const paragraphNode: DocumentNode = {
          id: generateId(`paragraph-${position}`),
          type: "paragraph",
          content: currentParagraph.trim(),
          level: 1,
          children: [],
          metadata: {
            charCount: currentParagraph.length,
            wordCount: currentParagraph.split(/\s+/).length,
            position,
          },
        };
        root.children.push(paragraphNode);
        position += currentParagraph.length;
        currentParagraph = "";
      }
    } else {
      currentParagraph += line + " ";
    }
  }

  // Add final paragraph
  if (currentParagraph.trim()) {
    const paragraphNode: DocumentNode = {
      id: generateId(`paragraph-${position}`),
      type: "paragraph",
      content: currentParagraph.trim(),
      level: 1,
      children: [],
      metadata: {
        charCount: currentParagraph.length,
        wordCount: currentParagraph.split(/\s+/).length,
        position,
      },
    };
    root.children.push(paragraphNode);
  }

  return {
    type: "text",
    tree: root,
    metadata: {
      totalChars: content.length,
      totalWords: content.split(/\s+/).length,
    },
  };
}

/**
 * Generate a unique ID
 */
function generateId(seed: string): string {
  return `node-${seed.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`;
}
