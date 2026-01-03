#!/usr/bin/env node

/**
 * Logseq MCP Server
 *
 * Provides tools for interacting with Logseq graphs:
 * - Page CRUD operations
 * - Search functionality
 * - Link/backlink navigation
 * - Graph visualization data
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GraphService } from './graph.js';

// 환경 변수에서 graph 경로 가져오기 (필수)
const GRAPH_PATH = process.env.LOGSEQ_GRAPH_PATH;
if (!GRAPH_PATH) {
  console.error('Error: LOGSEQ_GRAPH_PATH environment variable is required');
  process.exit(1);
}

const graph = new GraphService(GRAPH_PATH);

function createMcpServer() {
  const server = new Server(
    {
      name: 'logseq-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // 보안 상수
  const MAX_PATH_LENGTH = 500;
  const MAX_NAME_LENGTH = 200;
  const MAX_QUERY_LENGTH = 1000;
  const MAX_TAG_LENGTH = 100;
  const MAX_TAGS_COUNT = 50;
  const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB

  // Tool schemas with security limits
  const ListPagesSchema = z.object({
    folder: z.enum(['pages', 'journals']).optional().describe('폴더 필터: pages 또는 journals'),
  });

  const ReadPageSchema = z.object({
    path: z.string().max(MAX_PATH_LENGTH).describe('페이지 경로 또는 이름 (예: "pages/note" 또는 "note")'),
  });

  const CreatePageSchema = z.object({
    name: z.string().max(MAX_NAME_LENGTH).describe('생성할 페이지 이름'),
    content: z.string().max(MAX_CONTENT_LENGTH).describe('페이지 내용'),
    properties: z.record(z.string().max(10000)).optional().describe('Logseq 프로퍼티 (선택, 문자열 값만)'),
  });

  const UpdatePageSchema = z.object({
    path: z.string().max(MAX_PATH_LENGTH).describe('수정할 페이지 경로 또는 이름'),
    content: z.string().max(MAX_CONTENT_LENGTH).describe('새로운 페이지 내용'),
    properties: z.record(z.string().max(10000)).optional().describe('Logseq 프로퍼티 (선택, 문자열 값만)'),
  });

  const DeletePageSchema = z.object({
    path: z.string().max(MAX_PATH_LENGTH).describe('삭제할 페이지 경로 또는 이름'),
  });

  const AppendToPageSchema = z.object({
    path: z.string().max(MAX_PATH_LENGTH).describe('페이지 경로 또는 이름'),
    content: z.string().max(MAX_CONTENT_LENGTH).describe('추가할 내용'),
  });

  const SearchPagesSchema = z.object({
    query: z.string().max(MAX_QUERY_LENGTH).describe('검색어'),
    tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_TAGS_COUNT).optional().describe('태그 필터 (선택)'),
    folder: z.enum(['pages', 'journals']).optional().describe('폴더 필터 (선택)'),
  });

  const GetBacklinksSchema = z.object({
    path: z.string().max(MAX_PATH_LENGTH).describe('페이지 경로 또는 이름'),
  });

  const GetGraphSchema = z.object({
    center: z.string().max(MAX_NAME_LENGTH).optional().describe('중심 페이지 이름 (선택)'),
    depth: z.number().int().min(0).max(10).optional().describe('탐색 깊이 (기본값: 1, 최대: 10)'),
  });

  const GetJournalSchema = z.object({
    date: z.string().max(10).optional().describe('날짜 (YYYY-MM-DD, 기본값: 오늘)'),
  });

  const CreateJournalSchema = z.object({
    date: z.string().max(10).optional().describe('날짜 (YYYY-MM-DD, 기본값: 오늘)'),
    template: z.string().max(MAX_CONTENT_LENGTH).optional().describe('템플릿 내용 (선택)'),
  });

  const AddArticleSchema = z.object({
    title: z.string().max(500).describe('아티클 제목'),
    summary: z.string().max(2000).optional().describe('요약'),
    tags: z.string().max(500).optional().describe('태그 (쉼표 구분)'),
    url: z.string().max(2000).optional().describe('원본 URL'),
    highlights: z.string().max(10000).optional().describe('하이라이트 내용'),
    date: z.string().max(10).optional().describe('날짜 (YYYY-MM-DD, 기본값: 오늘)'),
  });

  const AddBookSchema = z.object({
    title: z.string().max(500).describe('책 제목'),
    author: z.string().max(200).optional().describe('저자'),
    tags: z.string().max(500).optional().describe('태그 (쉼표 구분)'),
    memo: z.string().max(10000).optional().describe('메모/감상'),
    date: z.string().max(10).optional().describe('날짜 (YYYY-MM-DD, 기본값: 오늘)'),
  });

  const AddMovieSchema = z.object({
    title: z.string().max(500).describe('영화 제목'),
    director: z.string().max(200).optional().describe('감독'),
    memo: z.string().max(10000).optional().describe('메모/감상'),
    date: z.string().max(10).optional().describe('날짜 (YYYY-MM-DD, 기본값: 오늘)'),
  });

  const AddExhibitionSchema = z.object({
    title: z.string().max(500).describe('전시회 제목'),
    venue: z.string().max(200).optional().describe('장소'),
    artist: z.string().max(200).optional().describe('작가/아티스트'),
    memo: z.string().max(10000).optional().describe('메모/감상'),
    date: z.string().max(10).optional().describe('날짜 (YYYY-MM-DD, 기본값: 오늘)'),
  });

  // Tool definitions
  const TOOLS = [
    {
      name: 'list_pages',
      description: 'Graph 내 모든 페이지 목록 조회. 각 페이지의 메타데이터(경로, 이름, 태그, 링크, 백링크) 반환',
      inputSchema: {
        type: 'object' as const,
        properties: {
          folder: { type: 'string', enum: ['pages', 'journals'], description: '폴더 필터: pages 또는 journals' },
        },
      },
    },
    {
      name: 'read_page',
      description: '특정 페이지의 전체 내용과 메타데이터 조회',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: '페이지 경로 또는 이름 (예: "pages/note" 또는 "note")' },
        },
        required: ['path'],
      },
    },
    {
      name: 'create_page',
      description: '새 페이지 생성. Logseq 프로퍼티 포함 가능',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: '생성할 페이지 이름' },
          content: { type: 'string', description: '페이지 내용' },
          properties: { type: 'object', description: 'Logseq 프로퍼티 (선택)' },
        },
        required: ['name', 'content'],
      },
    },
    {
      name: 'update_page',
      description: '기존 페이지 내용 수정',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: '수정할 페이지 경로 또는 이름' },
          content: { type: 'string', description: '새로운 페이지 내용' },
          properties: { type: 'object', description: 'Logseq 프로퍼티 (선택)' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'delete_page',
      description: '페이지 삭제',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: '삭제할 페이지 경로 또는 이름' },
        },
        required: ['path'],
      },
    },
    {
      name: 'append_to_page',
      description: '기존 페이지 끝에 내용 추가',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: '페이지 경로 또는 이름' },
          content: { type: 'string', description: '추가할 내용' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'search_pages',
      description: '페이지 내용/제목 검색. 태그 및 폴더 필터 지원',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: '검색어' },
          tags: { type: 'array', items: { type: 'string' }, description: '태그 필터 (선택)' },
          folder: { type: 'string', enum: ['pages', 'journals'], description: '폴더 필터 (선택)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_backlinks',
      description: '특정 페이지를 참조하는 모든 페이지 조회',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: '페이지 경로 또는 이름' },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_graph',
      description: '페이지 간 연결 그래프 데이터 조회. 링크/백링크/태그 관계 포함',
      inputSchema: {
        type: 'object' as const,
        properties: {
          center: { type: 'string', description: '중심 페이지 이름 (선택)' },
          depth: { type: 'number', description: '탐색 깊이 (기본값: 1)' },
        },
      },
    },
    {
      name: 'get_journal',
      description: '오늘 또는 특정 날짜의 저널 페이지 조회',
      inputSchema: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: '날짜 (YYYY-MM-DD, 기본값: 오늘)' },
        },
      },
    },
    {
      name: 'create_journal',
      description: '오늘 또는 특정 날짜의 저널 페이지 생성',
      inputSchema: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', description: '날짜 (YYYY-MM-DD, 기본값: 오늘)' },
          template: { type: 'string', description: '템플릿 내용 (선택)' },
        },
      },
    },
    {
      name: 'add_article',
      description: '오늘 저널에 아티클 정보 추가. 대화 정리, 웹 아티클, 읽은 글 등을 기록',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '아티클 제목' },
          summary: { type: 'string', description: '요약 (선택)' },
          tags: { type: 'string', description: '태그 - 쉼표 구분 (선택)' },
          url: { type: 'string', description: '원본 URL (선택)' },
          highlights: { type: 'string', description: '하이라이트/핵심 내용 (선택)' },
          date: { type: 'string', description: '날짜 (YYYY-MM-DD, 기본값: 오늘)' },
        },
        required: ['title'],
      },
    },
    {
      name: 'add_book',
      description: '오늘 저널에 책 정보 추가. 읽은 책, 읽고 싶은 책 기록',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '책 제목' },
          author: { type: 'string', description: '저자 (선택)' },
          tags: { type: 'string', description: '태그 - 쉼표 구분 (선택)' },
          memo: { type: 'string', description: '메모/감상 (선택)' },
          date: { type: 'string', description: '날짜 (YYYY-MM-DD, 기본값: 오늘)' },
        },
        required: ['title'],
      },
    },
    {
      name: 'add_movie',
      description: '오늘 저널에 영화 정보 추가. 본 영화, 보고 싶은 영화 기록',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '영화 제목' },
          director: { type: 'string', description: '감독 (선택)' },
          memo: { type: 'string', description: '메모/감상 (선택)' },
          date: { type: 'string', description: '날짜 (YYYY-MM-DD, 기본값: 오늘)' },
        },
        required: ['title'],
      },
    },
    {
      name: 'add_exhibition',
      description: '오늘 저널에 전시회 정보 추가. 본 전시회, 보고 싶은 전시회 기록',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '전시회 제목' },
          venue: { type: 'string', description: '장소 (선택)' },
          artist: { type: 'string', description: '작가/아티스트 (선택)' },
          memo: { type: 'string', description: '메모/감상 (선택)' },
          date: { type: 'string', description: '날짜 (YYYY-MM-DD, 기본값: 오늘)' },
        },
        required: ['title'],
      },
    },
  ];

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_pages': {
          const { folder } = ListPagesSchema.parse(args);
          const pages = await graph.listPages(folder);
          return {
            content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }],
          };
        }

        case 'read_page': {
          const { path } = ReadPageSchema.parse(args);
          const page = await graph.readPage(path);
          return {
            content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
          };
        }

        case 'create_page': {
          const { name: pageName, content, properties } = CreatePageSchema.parse(args);
          const page = await graph.createPage(pageName, content, properties);
          return {
            content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
          };
        }

        case 'update_page': {
          const { path, content, properties } = UpdatePageSchema.parse(args);
          const page = await graph.updatePage(path, content, properties);
          return {
            content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
          };
        }

        case 'delete_page': {
          const { path } = DeletePageSchema.parse(args);
          await graph.deletePage(path);
          return {
            content: [{ type: 'text', text: `페이지 삭제 완료: ${path}` }],
          };
        }

        case 'append_to_page': {
          const { path, content } = AppendToPageSchema.parse(args);
          const page = await graph.appendToPage(path, content);
          return {
            content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
          };
        }

        case 'search_pages': {
          const { query, tags, folder } = SearchPagesSchema.parse(args);
          const results = await graph.searchPages(query, { tags, folder });
          return {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
          };
        }

        case 'get_backlinks': {
          const { path } = GetBacklinksSchema.parse(args);
          const backlinks = await graph.getBacklinks(path);
          return {
            content: [{ type: 'text', text: JSON.stringify(backlinks, null, 2) }],
          };
        }

        case 'get_graph': {
          const { center, depth } = GetGraphSchema.parse(args);
          const graphData = await graph.getGraph({ center, depth });
          return {
            content: [{ type: 'text', text: JSON.stringify(graphData, null, 2) }],
          };
        }

        case 'get_journal': {
          const { date } = GetJournalSchema.parse(args);
          const page = await graph.getJournalPage(date);
          if (!page) {
            return {
              content: [{ type: 'text', text: '저널 페이지를 찾을 수 없습니다.' }],
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
          };
        }

        case 'create_journal': {
          const { date, template } = CreateJournalSchema.parse(args);
          const page = await graph.createJournalPage(date, template);
          return {
            content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
          };
        }

        case 'add_article': {
          const { title, summary, tags, url, highlights, date } = AddArticleSchema.parse(args);

          // 아티클 템플릿 생성 (Logseq indent 형식)
          const lines: string[] = [];
          lines.push('- [[article]]');
          lines.push('\t- #article');
          lines.push('\t\t- meta');
          lines.push(`\t\t\t- title : ${title}`);
          if (summary) {
            lines.push(`\t\t\t- summary : ${summary}`);
          }
          if (tags) {
            lines.push(`\t\t\t- tag : ${tags}`);
          }
          if (url) {
            lines.push(`\t\t\t- url : ${url}`);
          }
          if (highlights) {
            lines.push('\t\t- Highlights :');
            // 여러 줄 하이라이트 처리
            const highlightLines = highlights.split('\n');
            for (const line of highlightLines) {
              if (line.trim()) {
                lines.push(`\t\t\t- ${line.trim()}`);
              }
            }
          }

          const articleContent = lines.join('\n');

          // 저널에 추가
          const targetDate = date || undefined;
          const page = await graph.appendToJournalPage(targetDate, articleContent);

          return {
            content: [{ type: 'text', text: `아티클 추가 완료: ${title}\n\n${JSON.stringify(page, null, 2)}` }],
          };
        }

        case 'add_book': {
          const { title, author, tags, memo, date } = AddBookSchema.parse(args);

          // 책 템플릿 생성 (Logseq indent 형식) - [[문화]] 하위 구조
          const lines: string[] = [];
          lines.push('- [[문화]]');
          lines.push('\t- #책');
          lines.push(`\t\t- 제목 : ${title}`);
          if (author) {
            lines.push(`\t\t- 창작자 : ${author}`);
          }
          if (tags) {
            lines.push(`\t\t- 태그 : ${tags}`);
          }
          if (memo) {
            lines.push('\t\t- 메모 :');
            const memoLines = memo.split('\n');
            for (const line of memoLines) {
              if (line.trim()) {
                lines.push(`\t\t\t- ${line.trim()}`);
              }
            }
          }

          const bookContent = lines.join('\n');
          const targetDate = date || undefined;
          const page = await graph.appendToJournalPage(targetDate, bookContent);

          return {
            content: [{ type: 'text', text: `책 추가 완료: ${title}\n\n${JSON.stringify(page, null, 2)}` }],
          };
        }

        case 'add_movie': {
          const { title, director, memo, date } = AddMovieSchema.parse(args);

          // 영화 템플릿 생성 (Logseq indent 형식) - [[문화]] 하위 구조
          const lines: string[] = [];
          lines.push('- [[문화]]');
          lines.push('\t- #영화');
          lines.push(`\t\t- 제목 : ${title}`);
          if (director) {
            lines.push(`\t\t- 창작자 : ${director}`);
          }
          if (memo) {
            lines.push('\t\t- 메모 :');
            const memoLines = memo.split('\n');
            for (const line of memoLines) {
              if (line.trim()) {
                lines.push(`\t\t\t- ${line.trim()}`);
              }
            }
          }

          const movieContent = lines.join('\n');
          const targetDate = date || undefined;
          const page = await graph.appendToJournalPage(targetDate, movieContent);

          return {
            content: [{ type: 'text', text: `영화 추가 완료: ${title}\n\n${JSON.stringify(page, null, 2)}` }],
          };
        }

        case 'add_exhibition': {
          const { title, venue, artist, memo, date } = AddExhibitionSchema.parse(args);

          // 전시회 템플릿 생성 (Logseq indent 형식) - [[문화]] 하위 구조
          const lines: string[] = [];
          lines.push('- [[문화]]');
          lines.push('\t- #전시회');
          lines.push(`\t\t- 제목 : ${title}`);
          if (venue) {
            lines.push(`\t\t- 장소 : ${venue}`);
          }
          if (artist) {
            lines.push(`\t\t- 창작자 : ${artist}`);
          }
          if (memo) {
            lines.push('\t\t- 메모 :');
            const memoLines = memo.split('\n');
            for (const line of memoLines) {
              if (line.trim()) {
                lines.push(`\t\t\t- ${line.trim()}`);
              }
            }
          }

          const exhibitionContent = lines.join('\n');
          const targetDate = date || undefined;
          const page = await graph.appendToJournalPage(targetDate, exhibitionContent);

          return {
            content: [{ type: 'text', text: `전시회 추가 완료: ${title}\n\n${JSON.stringify(page, null, 2)}` }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // 보안: 에러 메시지에서 민감한 경로 정보 제거
      const message = error instanceof Error ? error.message : String(error);
      const sanitizedMessage = sanitizeErrorMessage(message);
      return {
        content: [{ type: 'text', text: `Error: ${sanitizedMessage}` }],
        isError: true,
      };
    }
  });

  /**
   * Sanitize error messages to prevent path disclosure
   */
  function sanitizeErrorMessage(message: string): string {
    // Node.js 파일 시스템 에러에서 경로 제거
    // 예: "ENOENT: no such file or directory, open '/full/path/to/file'"
    // -> "ENOENT: no such file or directory"

    // 알려진 안전한 에러 메시지는 그대로 반환
    const safePatterns = [
      'Invalid page name',
      'Page already exists',
      'Page not found',
      'Access denied',
      'Invalid date format',
      'Content too large',
      'Search query too long',
      'Invalid property',
    ];

    for (const pattern of safePatterns) {
      if (message.includes(pattern)) {
        return message;
      }
    }

    // Node.js 에러 코드만 추출 (경로 정보 제거)
    const errorCodes: Record<string, string> = {
      ENOENT: 'File or directory not found',
      EACCES: 'Permission denied',
      EEXIST: 'File already exists',
      EISDIR: 'Expected file but found directory',
      ENOTDIR: 'Expected directory but found file',
      ENOTEMPTY: 'Directory not empty',
      EPERM: 'Operation not permitted',
    };

    for (const [code, description] of Object.entries(errorCodes)) {
      if (message.includes(code)) {
        return description;
      }
    }

    // Zod 유효성 검사 에러는 그대로 반환 (경로 정보 없음)
    if (message.includes('Expected') || message.includes('Invalid')) {
      return message;
    }

    // 알 수 없는 에러는 일반 메시지로 대체
    return 'An unexpected error occurred';
  }

  // Resources: expose graph pages as resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const pages = await graph.listPages();
      return {
        resources: pages.map((page) => ({
          uri: `logseq://${page.path}`,
          name: page.name,
          mimeType: 'text/markdown',
          description: `${page.isJournal ? '[Journal] ' : ''}Tags: ${page.tags.join(', ') || 'none'}`,
        })),
      };
    } catch (error) {
      // 보안: 에러 메시지 sanitization
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(sanitizeErrorMessage(message));
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const uri = request.params.uri;
      // 보안: URI 길이 제한
      if (uri.length > 600) {
        throw new Error('URI too long');
      }
      const path = uri.replace('logseq://', '');
      const page = await graph.readPage(path);

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: page.content,
          },
        ],
      };
    } catch (error) {
      // 보안: 에러 메시지 sanitization
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(sanitizeErrorMessage(message));
    }
  });

  return server;
}

// Start server
async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Logseq MCP server started (stdio mode)');
  console.error(`Graph path: ${GRAPH_PATH}`);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
