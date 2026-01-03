# Logseq MCP Server

Logseq graph와 상호작용하는 MCP 서버.

## 구조

```
src/
  index.ts    # MCP 서버 엔트리포인트
  types.ts    # 타입 정의
  graph.ts    # Graph 파일 시스템 작업
```

## 명령어

- `npm run build` - TypeScript 빌드
- `npm run dev` - 개발 모드 실행
- `npm start` - 프로덕션 실행

## 설정

환경변수 `LOGSEQ_GRAPH_PATH`로 graph 경로 지정 (필수)
