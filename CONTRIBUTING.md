# Contributing

Thanks for your interest in improving `logseq-mcp`.

## Development

Requirements:

- Node.js 20 or newer
- npm
- A local Logseq graph for manual testing

Install and build:

```bash
npm ci
npm run build
npm test
```

Run the MCP server locally:

```bash
LOGSEQ_GRAPH_PATH=/absolute/path/to/logseq/graph npm start
```

## Pull Requests

Before opening a pull request:

1. Keep changes focused on one behavior or feature.
2. Add or update tests for file access, page operations, or MCP tool changes.
3. Run `npm run build` and `npm test`.
4. Avoid committing local graph data, secrets, or personal notes.

## Areas Where Help Is Welcome

- org-mode support
- Logseq property search
- Better graph traversal and filtering
- Cross-platform setup examples
- Security hardening for local file access
- Codex, Claude Code, and Claude Desktop compatibility docs
