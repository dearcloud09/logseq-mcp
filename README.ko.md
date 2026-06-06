# Logseq MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

> **AI가 당신의 Logseq 그래프를 직접 읽고 쓸 수 있게 해주는 MCP 서버**

[English README](README.md)

Codex, Claude Code, Claude Desktop과 대화하면서 "오늘 저널에 이거 추가해줘", "지난주에 뭐했는지 찾아봐", "이 페이지랑 연결된 거 다 보여줘"가 가능해집니다.

---

## Why This?

**문제**: Logseq는 훌륭한 PKM 도구지만, AI 어시스턴트와 연동하려면 매번 복사-붙여넣기가 필요합니다.

**해결**: 이 MCP 서버를 사용하면:
- AI 어시스턴트가 **직접** 저널에 기록 (복사-붙여넣기 불필요)
- 과거 기록을 **검색하고 요약** (맥락 유지)
- 페이지 간 **연결 관계 탐색** (백링크, 그래프)
- 템플릿 기반 **저널 자동 생성**

```
You: "오늘 회의 내용 저널에 정리해줘"
Claude: [logseq-mcp로 직접 저널에 기록]
        "저널에 추가했습니다. 다른 정리할 내용 있으세요?"
```

---

## Is This For You?

### Good fit if you...

- Logseq를 **주력 PKM**으로 사용 중
- Codex, Claude Code, Claude Desktop을 **일상적으로 사용**
- AI에게 노트 관리를 **위임**하고 싶음
- **로컬 파일 기반** Logseq 사용 (Logseq Sync 아님)

### Not for you if...

- **Logseq Sync** 사용 중 (로컬 파일 접근 필요)
- **Obsidian** 사용자 (다른 MCP 서버 필요)
- 노트에 민감 정보가 많고 **AI 접근이 불편**함
- 마크다운 외 **org-mode** 사용 (현재 미지원)

---

## Demo

<!-- TODO: 실제 사용 GIF 추가 -->
```
You: "지난주 저널에서 TODO 항목 다 찾아줘"
Claude: [search_pages 실행]

You: "이 중에서 완료 안 된 거 오늘 저널로 옮겨줘"
Claude: [read_page → append_to_page 실행]

You: "Goals 페이지 연결된 페이지들 보여줘"
Claude: [get_backlinks 실행]
```

---

## Features

| 기능 | 설명 |
|------|------|
| **Page CRUD** | 페이지 생성, 읽기, 수정, 삭제 + 프로퍼티 지원 |
| **Search** | 전체 검색 + 태그/폴더 필터링 |
| **Graph Navigation** | 링크, 백링크, 페이지 관계 탐색 |
| **Journal** | 오늘/특정 날짜 저널 접근 + 템플릿 지원 |
| **Article** | 대화 정리, 웹 아티클, 읽은 글을 저널에 기록 |
| **Daily Automation** | 날씨 정보 + 일기 템플릿 자동 생성 (launchd) |
| **Resources** | 그래프 페이지를 MCP 리소스로 노출 |

---

## Quick Start

### 1. 설치

배포 패키지 사용:

```bash
npx -y @dearcloud09/logseq-mcp
```

개발용 로컬 체크아웃 사용:

```bash
git clone https://github.com/dearcloud09/logseq-mcp.git
cd logseq-mcp
npm ci
npm run build
```

### 2. Codex 설정

`~/.codex/config.toml`에 MCP 서버를 추가합니다:

```toml
[mcp_servers.logseq]
command = "npx"
args = ["-y", "@dearcloud09/logseq-mcp"]

[mcp_servers.logseq.env]
LOGSEQ_GRAPH_PATH = "/path/to/your/logseq/graph"
WEATHER_LOCATION = "서울"
```

Codex에서 `/mcp`를 실행해 `logseq` 서버가 연결되었는지 확인합니다.

### 3. Claude 설정

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "logseq": {
      "command": "npx",
      "args": ["-y", "@dearcloud09/logseq-mcp"],
      "env": {
        "LOGSEQ_GRAPH_PATH": "/path/to/your/logseq/graph",
        "WEATHER_LOCATION": "서울"
      }
    }
  }
}
```

> `WEATHER_LOCATION`: 날씨 정보를 가져올 지역 (기본값: 서울)

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "logseq": {
      "command": "npx",
      "args": ["-y", "@dearcloud09/logseq-mcp"],
      "env": {
        "LOGSEQ_GRAPH_PATH": "/path/to/your/logseq/graph",
        "WEATHER_LOCATION": "서울"
      }
    }
  }
}
```

로컬 체크아웃을 직접 실행하려면 command를 `node`, args를
`["/absolute/path/to/logseq-mcp/dist/index.js"]`로 바꿉니다.

### 4. 확인

MCP 클라이언트에게 물어보세요: "내 Logseq 페이지 목록 보여줘"

---

## Available Tools

| Tool | Description |
|------|-------------|
| `list_pages` | 전체 페이지 목록 + 메타데이터 (태그, 링크, 백링크) |
| `read_page` | 페이지 내용 및 메타데이터 조회 |
| `create_page` | 새 페이지 생성 (프로퍼티 지원) |
| `update_page` | 페이지 내용 수정 |
| `delete_page` | 페이지 삭제 |
| `append_to_page` | 기존 페이지에 내용 추가 |
| `search_pages` | 내용/제목 검색 + 태그/폴더 필터 |
| `get_backlinks` | 특정 페이지를 참조하는 페이지들 |
| `get_graph` | 페이지 연결 그래프 데이터 |
| `get_journal` | 오늘/특정 날짜 저널 조회 |
| `create_journal` | 저널 생성 (템플릿 지원) |
| `add_article` | 아티클을 저널에 추가 (제목, 요약, 태그, URL, 하이라이트) |
| `add_book` | 책을 저널에 추가 → `[[문화]]` 하위에 기록 (제목, 창작자, 태그, 메모) |
| `add_movie` | 영화를 저널에 추가 → `[[문화]]` 하위에 기록 (제목, 창작자, 메모) |
| `add_exhibition` | 전시회를 저널에 추가 → `[[문화]]` 하위에 기록 (제목, 장소, 창작자, 메모) |

---

## Usage Examples

```
"오늘 저널 보여줘"
"'프로젝트 A' 페이지에 이 내용 추가해줘: ..."
"#meeting 태그 달린 페이지 다 찾아줘"
"Goals 페이지랑 연결된 페이지들 뭐가 있어?"
"지난주 저널에서 TODO 검색해줘"
"새 페이지 만들어줘: 제목은 'Reading List'"
"우리 대화 내용 아티클로 정리해서 저널에 저장해줘"
```

---

## Logseq Graph Structure

```
your-graph/
  journals/     # 저널 (2024_01_15.md 형식)
  pages/        # 일반 페이지
  logseq/       # Logseq 설정
  whiteboards/  # 화이트보드
```

---

## Security

Graph 외부 파일 접근 차단, 심링크/하드링크 차단, 입력 검증, DoS 방지,
에러 메시지 정제 등 보안 강화가 적용되어 있습니다. 자세한 보안 모델은
[SECURITY.md](SECURITY.md)를 참고하세요.

---

## Troubleshooting

### "LOGSEQ_GRAPH_PATH environment variable is required"

`LOGSEQ_GRAPH_PATH` 환경변수가 설정되지 않았습니다. 설정 파일에서 경로를 확인하세요.

### MCP 서버가 Codex 또는 Claude에서 인식되지 않음

1. Node.js 20 이상이 설치되어 있는지 확인
2. `LOGSEQ_GRAPH_PATH`가 절대 경로인지 확인 (`/Users/...` 형식)
3. Codex에서는 `/mcp`를 실행해 `logseq` 서버가 보이는지 확인
4. 로컬 체크아웃을 사용하는 경우 `npm run build` 실행 확인

### 페이지가 보이지 않음

- `journals/`, `pages/` 폴더에 `.md` 파일이 있는지 확인
- Logseq Sync가 아닌 **로컬 그래프**인지 확인

### org-mode 파일이 안 읽힘

현재 **Markdown만 지원**합니다. org-mode 지원은 추후 예정.

---

## Daily Automation (Optional)

매일 아침 자동으로 저널에 날씨 + 일기 템플릿을 추가하는 기능:

### 설정 방법

1. plist 파일 복사 및 경로 수정:
```bash
cp com.logseq.daily-automation.plist.example ~/Library/LaunchAgents/com.logseq.daily-automation.plist
```

2. 복사한 파일에서 `/path/to/` 부분을 실제 경로로 수정

3. launchd 등록:
```bash
launchctl load ~/Library/LaunchAgents/com.logseq.daily-automation.plist
```

### 수동 실행 테스트

```bash
./run-daily-automation.sh
```

생성되는 템플릿:
```markdown
- [[일기]]
  - [[날씨]]
    - 맑음
    - 최저 기온 1도, 최고 기온 10도
    - ...
  - [[오늘의 일기]]
    - [[행복도]]
      - [[오늘의 행복]]
    - [[오늘의 컨디션]]
      - [[수면]]
        - 취침:
        - 기상:
        - 질: /5
    - [[오늘의 생각]]
  - [[Tasks]]
    - TODO
    - [[오늘 잘 해낸 일]]
  - [[TIL]]
```

### 문화 콘텐츠 기록 구조

`add_book`, `add_movie`, `add_exhibition` 도구는 통합된 `[[문화]]` 구조를 사용:

```markdown
- [[문화]]
  - #책
    - 제목 : 총균쇠
    - 창작자 : 재레드 다이아몬드
    - 메모 : ...

- [[문화]]
  - #영화
    - 제목 : 인셉션
    - 창작자 : 크리스토퍼 놀란
    - 메모 : ...

- [[문화]]
  - #전시회
    - 제목 : 이건희 컬렉션
    - 장소 : 국립중앙박물관
    - 창작자 : 다수
    - 메모 : ...
```

Logseq 쿼리 예시:
```clojure
{{query [[문화]]}}           ;; 모든 문화 콘텐츠
{{query (and [[문화]] #책)}} ;; 책만
```

---

## Development

```bash
# 의존성 설치
npm ci

# 개발 모드 (hot reload)
npm run dev

# TypeScript 빌드
npm run build

# 회귀 테스트
npm test

# npm 패키지 내용 확인
npm pack --dry-run

# 프로덕션 실행
npm start
```

### Project Structure

```
src/
  index.ts    # MCP 서버 엔트리포인트, 도구 핸들러
  types.ts    # TypeScript 타입 정의
  graph.ts    # 그래프 파일시스템 작업
```

---

## Contributing

이슈와 PR 환영합니다! 자세한 개발/테스트 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

1. Fork this repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

### Ideas for contribution

- [ ] org-mode 지원
- [ ] Logseq 프로퍼티 검색
- [ ] 화이트보드 지원
- [ ] 더 나은 그래프 시각화 데이터

---

## License

[MIT](LICENSE)

---

## Related

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Logseq](https://logseq.com/)
- [Codex](https://developers.openai.com/codex/)
- [Claude Code](https://claude.com/claude-code)
