/**
 * Logseq MCP Type Definitions
 */

export interface Page {
  path: string;
  name: string;
  content: string;
  properties: Record<string, unknown>;
  tags: string[];
  links: string[];
  backlinks: string[];
  isJournal: boolean;
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface PageMetadata {
  path: string;
  name: string;
  tags: string[];
  links: string[];
  backlinks: string[];
  isJournal: boolean;
}

export interface Block {
  id: string;
  content: string;
  children: Block[];
  properties: Record<string, unknown>;
}

export interface SearchResult {
  page: PageMetadata;
  matches: SearchMatch[];
}

export interface SearchMatch {
  line: number;
  content: string;
  context: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'page' | 'tag' | 'journal';
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'link' | 'tag' | 'backlink';
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphConfig {
  path: string;
  journalsPath: string;
  pagesPath: string;
}
