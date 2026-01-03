/**
 * Logseq Graph Service
 * Handles file system operations for Logseq graphs
 */

import { readdir, readFile, writeFile, unlink, mkdir, stat, lstat } from 'node:fs/promises';
import { join, basename, extname, resolve } from 'node:path';
import type { Page, PageMetadata, SearchResult, SearchMatch, Graph, GraphNode, GraphEdge } from './types.js';

// 보안 상수
const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB - DoS 방지
const MAX_DEPTH = 10; // 그래프 탐색 최대 깊이

export class GraphService {
  private graphPath: string;
  private pagesPath: string;
  private journalsPath: string;

  constructor(graphPath: string) {
    this.graphPath = graphPath;
    this.pagesPath = join(graphPath, 'pages');
    this.journalsPath = join(graphPath, 'journals');
  }

  /**
   * List all pages in the graph
   */
  async listPages(folder?: string): Promise<PageMetadata[]> {
    const pages: PageMetadata[] = [];
    const backlinksMap = new Map<string, string[]>();

    // Collect all pages first to build backlinks
    const allPages = await this.collectAllPages();

    // Build backlinks map
    for (const page of allPages) {
      for (const link of page.links) {
        const existing = backlinksMap.get(link) || [];
        existing.push(page.name);
        backlinksMap.set(link, existing);
      }
    }

    // Filter by folder if specified
    let filteredPages = allPages;
    if (folder) {
      if (folder === 'journals') {
        filteredPages = allPages.filter(p => p.isJournal);
      } else if (folder === 'pages') {
        filteredPages = allPages.filter(p => !p.isJournal);
      }
    }

    // Add backlinks to each page
    for (const page of filteredPages) {
      pages.push({
        ...page,
        backlinks: backlinksMap.get(page.name) || [],
      });
    }

    return pages;
  }

  private async collectAllPages(): Promise<PageMetadata[]> {
    const pages: PageMetadata[] = [];

    // Read pages folder
    try {
      const pageFiles = await readdir(this.pagesPath);
      for (const file of pageFiles) {
        if (extname(file) === '.md') {
          const filePath = join(this.pagesPath, file);
          // 보안: 심링크 공격 방지 - 심링크는 건너뜀
          try {
            const stats = await lstat(filePath);
            if (stats.isSymbolicLink()) continue;
          } catch {
            continue;
          }
          const content = await readFile(filePath, 'utf-8');
          const name = basename(file, '.md');
          pages.push({
            path: `pages/${file}`,
            name,
            tags: this.extractTags(content),
            links: this.extractLinks(content),
            backlinks: [],
            isJournal: false,
          });
        }
      }
    } catch (e) {
      // pages folder might not exist
    }

    // Read journals folder
    try {
      const journalFiles = await readdir(this.journalsPath);
      for (const file of journalFiles) {
        if (extname(file) === '.md') {
          const filePath = join(this.journalsPath, file);
          // 보안: 심링크 공격 방지 - 심링크는 건너뜀
          try {
            const stats = await lstat(filePath);
            if (stats.isSymbolicLink()) continue;
          } catch {
            continue;
          }
          const content = await readFile(filePath, 'utf-8');
          const name = basename(file, '.md');
          pages.push({
            path: `journals/${file}`,
            name,
            tags: this.extractTags(content),
            links: this.extractLinks(content),
            backlinks: [],
            isJournal: true,
          });
        }
      }
    } catch (e) {
      // journals folder might not exist
    }

    return pages;
  }

  /**
   * Read a page by path or name
   */
  async readPage(pathOrName: string): Promise<Page> {
    const filePath = await this.resolvePath(pathOrName);
    await this.checkSymlink(filePath); // 심링크 공격 방지
    const content = await readFile(filePath, 'utf-8');
    const name = basename(filePath, '.md');
    const isJournal = filePath.includes('/journals/');

    const { properties, body } = this.parseProperties(content);
    const stats = await stat(filePath);

    // Get backlinks
    const allPages = await this.collectAllPages();
    const backlinks = allPages
      .filter(p => p.links.includes(name))
      .map(p => p.name);

    return {
      path: filePath.replace(this.graphPath + '/', ''),
      name,
      content: body,
      properties,
      tags: this.extractTags(content),
      links: this.extractLinks(content),
      backlinks,
      isJournal,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  }

  /**
   * Validate page name (whitelist approach for security)
   */
  private validatePageName(name: string): void {
    // 최대 길이 제한 (파일시스템 호환성)
    if (name.length > 200) {
      throw new Error('Invalid page name: too long (max 200 characters)');
    }

    // 빈 이름 금지
    if (name.trim().length === 0) {
      throw new Error('Invalid page name: cannot be empty');
    }

    // 화이트리스트: 알파벳, 숫자, 한글, 공백, 일부 안전한 특수문자만 허용
    // 금지: / \ .. : * ? " < > | null문자 등
    const safePattern = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s_\-().,'!@#$%&+=\[\]{}]+$/;
    if (!safePattern.test(name)) {
      throw new Error('Invalid page name: contains forbidden characters');
    }

    // 명시적으로 위험한 패턴 차단
    const dangerousPatterns = ['..', '/', '\\', '\x00', ':', '*', '?', '"', '<', '>', '|'];
    for (const pattern of dangerousPatterns) {
      if (name.includes(pattern)) {
        throw new Error('Invalid page name: contains forbidden characters');
      }
    }
  }

  /**
   * Create a new page
   */
  async createPage(name: string, content: string, properties?: Record<string, unknown>): Promise<Page> {
    // 보안 검증: 화이트리스트 기반 이름 검증
    this.validatePageName(name);

    const filePath = join(this.pagesPath, `${name}.md`);
    this.validatePath(filePath);

    // 보안 검증: 콘텐츠 크기 제한 (DoS 방지)
    this.validateContentSize(content);

    // Ensure pages directory exists
    await mkdir(this.pagesPath, { recursive: true });

    // 보안 검증: 심링크 공격 방지
    await this.checkSymlink(filePath);

    const fullContent = this.buildContent(content, properties);

    // 보안: TOCTOU 방지 - 'wx' 플래그로 원자적 생성 (파일 존재 시 실패)
    try {
      await writeFile(filePath, fullContent, { encoding: 'utf-8', flag: 'wx' });
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        throw new Error(`Page already exists: ${name}`);
      }
      throw e;
    }

    return this.readPage(name);
  }

  /**
   * Update an existing page
   */
  async updatePage(pathOrName: string, content: string, properties?: Record<string, unknown>): Promise<Page> {
    // 보안 검증: 콘텐츠 크기 제한 (DoS 방지)
    this.validateContentSize(content);

    const filePath = await this.resolvePath(pathOrName);
    await this.checkSymlink(filePath); // 심링크 공격 방지
    const fullContent = this.buildContent(content, properties);
    await writeFile(filePath, fullContent, 'utf-8');
    return this.readPage(pathOrName);
  }

  /**
   * Delete a page
   */
  async deletePage(pathOrName: string): Promise<void> {
    const filePath = await this.resolvePath(pathOrName);
    await this.checkSymlink(filePath); // 보안: 심링크 공격 방지
    await unlink(filePath);
  }

  /**
   * Append content to a page
   */
  async appendToPage(pathOrName: string, content: string): Promise<Page> {
    // 보안 검증: 추가할 콘텐츠 크기 제한 (DoS 방지)
    this.validateContentSize(content);

    const filePath = await this.resolvePath(pathOrName);
    await this.checkSymlink(filePath); // 심링크 공격 방지
    const existing = await readFile(filePath, 'utf-8');
    const newContent = existing.trimEnd() + '\n' + content;

    // 결합된 콘텐츠도 크기 검증
    this.validateContentSize(newContent);

    await writeFile(filePath, newContent, 'utf-8');
    return this.readPage(pathOrName);
  }

  /**
   * Search pages
   */
  async searchPages(query: string, options?: { tags?: string[]; folder?: string }): Promise<SearchResult[]> {
    // 보안: 검색어 길이 제한 (DoS 방지)
    if (query.length > 1000) {
      throw new Error('Search query too long (max 1000 characters)');
    }

    const results: SearchResult[] = [];
    const pages = await this.listPages(options?.folder);
    const queryLower = query.toLowerCase();

    for (const page of pages) {
      // Filter by tags if specified
      if (options?.tags && options.tags.length > 0) {
        const hasTag = options.tags.some(tag => page.tags.includes(tag));
        if (!hasTag) continue;
      }

      // Search in content
      const filePath = join(this.graphPath, page.path);

      // 보안: TOCTOU 방지 - 심링크/하드링크 체크
      try {
        await this.checkRegularFile(filePath);
      } catch {
        continue; // 심링크/하드링크/특수파일은 건너뜀
      }

      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: SearchMatch[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          matches.push({
            line: i + 1,
            content: lines[i],
            context: lines.slice(Math.max(0, i - 1), i + 2).join('\n'),
          });
        }
      }

      // Also match page name
      if (page.name.toLowerCase().includes(queryLower) || matches.length > 0) {
        results.push({ page, matches });
      }
    }

    return results;
  }

  /**
   * Get backlinks for a page
   */
  async getBacklinks(pathOrName: string): Promise<PageMetadata[]> {
    const page = await this.readPage(pathOrName);
    const allPages = await this.listPages();
    return allPages.filter(p => p.links.includes(page.name));
  }

  /**
   * Get graph data
   */
  async getGraph(options?: { center?: string; depth?: number }): Promise<Graph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeSet = new Set<string>();
    const pages = await this.listPages();

    const addNode = (id: string, name: string, type: GraphNode['type']) => {
      if (!nodeSet.has(id)) {
        nodeSet.add(id);
        nodes.push({ id, name, type });
      }
    };

    if (options?.center) {
      // Build graph around center node
      const visited = new Set<string>();
      const queue: { name: string; depth: number }[] = [{ name: options.center, depth: 0 }];
      // 보안: depth는 0 이상, MAX_DEPTH 이하로 제한
      const requestedDepth = options.depth ?? 1;
      const maxDepth = Math.max(0, Math.min(requestedDepth, MAX_DEPTH));

      while (queue.length > 0) {
        const { name, depth } = queue.shift()!;
        if (visited.has(name) || depth > maxDepth) continue;
        visited.add(name);

        const page = pages.find(p => p.name === name);
        if (!page) continue;

        const nodeType = page.isJournal ? 'journal' : 'page';
        addNode(name, name, nodeType);

        // Add links
        for (const link of page.links) {
          addNode(link, link, 'page');
          edges.push({ source: name, target: link, type: 'link' });
          if (depth < maxDepth) {
            queue.push({ name: link, depth: depth + 1 });
          }
        }

        // Add backlinks
        for (const backlink of page.backlinks) {
          addNode(backlink, backlink, 'page');
          edges.push({ source: backlink, target: name, type: 'backlink' });
          if (depth < maxDepth) {
            queue.push({ name: backlink, depth: depth + 1 });
          }
        }

        // Add tags
        for (const tag of page.tags) {
          addNode(`tag:${tag}`, tag, 'tag');
          edges.push({ source: name, target: `tag:${tag}`, type: 'tag' });
        }
      }
    } else {
      // Full graph
      for (const page of pages) {
        const nodeType = page.isJournal ? 'journal' : 'page';
        addNode(page.name, page.name, nodeType);

        for (const link of page.links) {
          addNode(link, link, 'page');
          edges.push({ source: page.name, target: link, type: 'link' });
        }

        for (const tag of page.tags) {
          addNode(`tag:${tag}`, tag, 'tag');
          edges.push({ source: page.name, target: `tag:${tag}`, type: 'tag' });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Get journal page for a date
   */
  async getJournalPage(date?: string): Promise<Page | null> {
    const targetDate = date || this.getTodayString();

    // Validate date format (YYYY-MM-DD only)
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format: use YYYY-MM-DD');
    }

    const fileName = targetDate.replace(/-/g, '_') + '.md';
    const filePath = join(this.journalsPath, fileName);
    this.validatePath(filePath);

    try {
      await stat(filePath);
      return this.readPage(`journals/${fileName}`);
    } catch {
      return null;
    }
  }

  /**
   * Create journal page
   */
  async createJournalPage(date?: string, template?: string): Promise<Page> {
    const targetDate = date || this.getTodayString();

    // Validate date format (YYYY-MM-DD only)
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format: use YYYY-MM-DD');
    }

    // 보안 검증: 템플릿 크기 제한 (DoS 방지)
    if (template) {
      this.validateContentSize(template);
    }

    const fileName = targetDate.replace(/-/g, '_') + '.md';
    const filePath = join(this.journalsPath, fileName);
    this.validatePath(filePath);

    // Ensure journals directory exists
    await mkdir(this.journalsPath, { recursive: true });

    // 보안 검증: 심링크 공격 방지
    await this.checkSymlink(filePath);

    // Check if already exists
    try {
      await stat(filePath);
      return this.readPage(`journals/${fileName}`);
    } catch {
      // Create new journal page
      const content = template || `- `;
      await writeFile(filePath, content, 'utf-8');
      return this.readPage(`journals/${fileName}`);
    }
  }

  /**
   * Append content to journal page (creates if doesn't exist)
   */
  async appendToJournalPage(date?: string, content?: string): Promise<Page> {
    const targetDate = date || this.getTodayString();

    // Validate date format (YYYY-MM-DD only)
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format: use YYYY-MM-DD');
    }

    // 보안 검증: 콘텐츠 크기 제한
    if (content) {
      this.validateContentSize(content);
    }

    const fileName = targetDate.replace(/-/g, '_') + '.md';
    const filePath = join(this.journalsPath, fileName);
    this.validatePath(filePath);

    // Ensure journals directory exists
    await mkdir(this.journalsPath, { recursive: true });

    // 보안 검증: 심링크 공격 방지
    await this.checkSymlink(filePath);

    // Get existing content or create new
    let existingContent = '';
    try {
      existingContent = await readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist, start with empty
    }

    // Append content
    const newContent = existingContent
      ? existingContent + '\n' + (content || '')
      : (content || '- ');

    await writeFile(filePath, newContent, 'utf-8');
    return this.readPage(`journals/${fileName}`);
  }

  // Helper methods

  /**
   * Validate content size (prevents DoS attacks)
   */
  private validateContentSize(content: string): void {
    const byteSize = Buffer.byteLength(content, 'utf-8');
    if (byteSize > MAX_CONTENT_SIZE) {
      throw new Error(`Content too large: ${Math.round(byteSize / 1024 / 1024)}MB exceeds limit of 10MB`);
    }
  }

  /**
   * Check if path is a symlink (prevents symlink escape attacks)
   */
  private async checkSymlink(filePath: string): Promise<void> {
    try {
      const stats = await lstat(filePath);
      if (stats.isSymbolicLink()) {
        throw new Error(`Access denied: symbolic links not allowed`);
      }
    } catch (e: any) {
      // ENOENT is ok (file doesn't exist yet), rethrow symlink errors
      if (e.message?.includes('symbolic links')) throw e;
    }
  }

  /**
   * Check if path is a regular file (prevents symlink/hardlink attacks)
   * More strict than checkSymlink - also detects hardlinks to external files
   */
  private async checkRegularFile(filePath: string): Promise<void> {
    const stats = await lstat(filePath);

    // 심링크 차단
    if (stats.isSymbolicLink()) {
      throw new Error(`Access denied: symbolic links not allowed`);
    }

    // 일반 파일만 허용 (디렉토리, 소켓, 디바이스 등 차단)
    if (!stats.isFile()) {
      throw new Error(`Access denied: not a regular file`);
    }

    // 하드링크 감지: nlink > 1이면 다른 곳에서 링크된 파일
    // 주의: 정상적인 경우에도 nlink > 1일 수 있으나, 보안을 위해 차단
    if (stats.nlink > 1) {
      throw new Error(`Access denied: hardlinks not allowed`);
    }
  }

  /**
   * Validate that a path is within the graph directory (prevents path traversal attacks)
   */
  private validatePath(filePath: string): string {
    const normalizedPath = resolve(filePath);
    const normalizedGraphPath = resolve(this.graphPath);

    if (!normalizedPath.startsWith(normalizedGraphPath + '/') && normalizedPath !== normalizedGraphPath) {
      throw new Error(`Access denied: path outside graph directory`);
    }

    return normalizedPath;
  }

  private async resolvePath(pathOrName: string): Promise<string> {
    // If it's already a relative path
    if (pathOrName.includes('/')) {
      const filePath = join(this.graphPath, pathOrName);
      return this.validatePath(filePath);
    }

    // Try pages first
    const pagePath = join(this.pagesPath, `${pathOrName}.md`);
    try {
      const validPath = this.validatePath(pagePath);
      await stat(validPath);
      return validPath;
    } catch (e: any) {
      if (e.message?.includes('Access denied')) throw e;
    }

    // Try journals (with underscore format)
    const journalPath = join(this.journalsPath, `${pathOrName.replace(/-/g, '_')}.md`);
    try {
      const validPath = this.validatePath(journalPath);
      await stat(validPath);
      return validPath;
    } catch (e: any) {
      if (e.message?.includes('Access denied')) throw e;
    }

    // Try journals with original name
    const journalPath2 = join(this.journalsPath, `${pathOrName}.md`);
    try {
      const validPath = this.validatePath(journalPath2);
      await stat(validPath);
      return validPath;
    } catch (e: any) {
      if (e.message?.includes('Access denied')) throw e;
    }

    throw new Error(`Page not found: ${pathOrName}`);
  }

  private extractTags(content: string): string[] {
    const tagRegex = /#([a-zA-Z0-9_\-/\uAC00-\uD7A3]+)/g;
    const tags = new Set<string>();
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }
    return Array.from(tags);
  }

  private extractLinks(content: string): string[] {
    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links = new Set<string>();
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.add(match[1]);
    }
    return Array.from(links);
  }

  private parseProperties(content: string): { properties: Record<string, unknown>; body: string } {
    const lines = content.split('\n');
    const properties: Record<string, unknown> = {};
    let bodyStart = 0;

    // Logseq properties are at the start with format: key:: value
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^([a-zA-Z_-]+)::\s*(.*)$/);
      if (match) {
        properties[match[1]] = match[2];
        bodyStart = i + 1;
      } else if (lines[i].trim() === '') {
        continue;
      } else {
        break;
      }
    }

    return {
      properties,
      body: lines.slice(bodyStart).join('\n'),
    };
  }

  /**
   * Validate and sanitize properties (prevents injection attacks)
   */
  private validateProperties(properties: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(properties)) {
      const keyStr = String(key);
      const valueStr = String(value);

      // 키에 개행문자, ::, 특수문자 금지
      if (/[\n\r]/.test(keyStr) || keyStr.includes('::')) {
        throw new Error(`Invalid property key: contains forbidden characters`);
      }

      // 값에 개행문자 금지 (Logseq 구조 오염 방지)
      if (/[\n\r]/.test(valueStr)) {
        throw new Error(`Invalid property value: contains newline characters`);
      }

      // 키는 알파벳, 숫자, -, _ 만 허용
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(keyStr)) {
        throw new Error(`Invalid property key: must start with letter and contain only alphanumeric, dash, underscore`);
      }
    }
  }

  private buildContent(content: string, properties?: Record<string, unknown>): string {
    if (!properties || Object.keys(properties).length === 0) {
      return content;
    }

    // 보안 검증
    this.validateProperties(properties);

    const propLines = Object.entries(properties)
      .map(([key, value]) => `${key}:: ${value}`)
      .join('\n');

    return propLines + '\n\n' + content;
  }

  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
