# Logseq MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

> **Let AI read and write your Logseq graph directly via MCP**

[한국어 README](README.ko.md)

Ask Codex, Claude Code, or Claude Desktop to "add this to today's journal", "find what I did last week", or "show me all pages linked to this one" - and it just works.

---

## Why This?

**Problem**: Logseq is a great PKM tool, but integrating with AI assistants requires constant copy-pasting.

**Solution**: With this MCP server:
- Claude **directly** writes to your journal (no copy-paste)
- **Search and summarize** past entries (maintain context)
- **Navigate connections** between pages (backlinks, graph)
- **Auto-generate** daily journals with templates

```
You: "Summarize today's meeting notes and add them to my journal"
Claude: [writes directly to Logseq via logseq-mcp]
        "Done! Added to today's journal. Anything else?"
```

---

## Is This For You?

### Good fit if you...

- Use Logseq as your **primary PKM**
- Use **Codex, Claude Code, or Claude Desktop** regularly
- Want to **delegate** note management to AI
- Use **local file-based** Logseq (not Logseq Sync)

### Not for you if...

- Using **Logseq Sync** (requires local file access)
- **Obsidian** user (different MCP server needed)
- Have sensitive info in notes and **uncomfortable with AI access**
- Use **org-mode** instead of Markdown (not yet supported)

---

## Features

| Feature | Description |
|---------|-------------|
| **Page CRUD** | Create, read, update, delete pages + property support |
| **Search** | Full-text search + tag/folder filtering |
| **Graph Navigation** | Links, backlinks, page relationship traversal |
| **Journal** | Access today's/specific date journals + templates |
| **Content Logging** | Log articles, books, movies, exhibitions to journal |
| **Resources** | Expose graph pages as MCP resources |

---

## Quick Start

### 1. Install

Use the published package:

```bash
npx -y @dearcloud09/logseq-mcp
```

Or install from a local checkout for development:

```bash
git clone https://github.com/dearcloud09/logseq-mcp.git
cd logseq-mcp
npm ci
npm run build
```

### 2. Configure Codex

Add the MCP server to `~/.codex/config.toml`:

```toml
[mcp_servers.logseq]
command = "npx"
args = ["-y", "@dearcloud09/logseq-mcp"]

[mcp_servers.logseq.env]
LOGSEQ_GRAPH_PATH = "/path/to/your/logseq/graph"
```

Then open Codex and run `/mcp` to confirm the `logseq` server is connected.

### 3. Configure Claude

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "logseq": {
      "command": "npx",
      "args": ["-y", "@dearcloud09/logseq-mcp"],
      "env": {
        "LOGSEQ_GRAPH_PATH": "/path/to/your/logseq/graph"
      }
    }
  }
}
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "logseq": {
      "command": "npx",
      "args": ["-y", "@dearcloud09/logseq-mcp"],
      "env": {
        "LOGSEQ_GRAPH_PATH": "/path/to/your/logseq/graph"
      }
    }
  }
}
```

For a local checkout, replace the command with `node` and the args with
`["/absolute/path/to/logseq-mcp/dist/index.js"]`.

### 4. Verify

Ask your MCP client: "Show me my Logseq page list"

---

## Available Tools

| Tool | Description |
|------|-------------|
| `list_pages` | List all pages with metadata (tags, links, backlinks) |
| `read_page` | Read page content and metadata |
| `create_page` | Create new page (with property support) |
| `update_page` | Update page content |
| `delete_page` | Delete a page |
| `append_to_page` | Append content to existing page |
| `search_pages` | Search by content/title + tag/folder filters |
| `get_backlinks` | Get pages that reference a specific page |
| `get_graph` | Get page connection graph data |
| `get_journal` | Get today's or specific date's journal |
| `create_journal` | Create journal with optional template |
| `add_article` | Add article to journal (title, summary, tags, URL, highlights) |
| `add_book` | Add book to journal (title, author, tags, memo) |
| `add_movie` | Add movie to journal (title, director, memo) |
| `add_exhibition` | Add exhibition to journal (title, venue, artist, memo) |

---

## Usage Examples

```
"Show me today's journal"
"Add this content to 'Project A' page: ..."
"Find all pages with #meeting tag"
"What pages are connected to my Goals page?"
"Search for TODO items in last week's journals"
"Create a new page called 'Reading List'"
"Summarize our conversation and save it as an article in my journal"
```

---

## Logseq Graph Structure

```
your-graph/
  journals/     # Daily journals (2024_01_15.md format)
  pages/        # Regular pages
  logseq/       # Logseq settings
  whiteboards/  # Whiteboards
```

---

## Security

- Path traversal protection (graph-only access)
- Symlink/hardlink attack prevention
- Input validation and sanitization
- DoS protection (content size limits)
- Error message sanitization

See [SECURITY.md](SECURITY.md) for the full security model.

---

## Troubleshooting

### "LOGSEQ_GRAPH_PATH environment variable is required"

Set `LOGSEQ_GRAPH_PATH` in your configuration file.

### MCP server not recognized by Codex or Claude

1. Confirm Node.js 20+ is installed
2. Confirm `LOGSEQ_GRAPH_PATH` is an absolute path (`/Users/...` format)
3. In Codex, run `/mcp` and check whether `logseq` is listed
4. For a local checkout, ensure `npm run build` was executed

### Pages not showing up

- Check if `.md` files exist in `journals/` or `pages/`
- Verify you're using **local graph** (not Logseq Sync)

### org-mode files not reading

Currently **Markdown only**. org-mode support planned for future.

---

## Korean-Specific Features

This project includes features optimized for Korean users:

### Daily Automation (Optional)

Auto-generate daily journal with weather (Korea only - uses Naver Weather) and diary template.

1. Copy and edit plist file:
```bash
cp com.logseq.daily-automation.plist.example ~/Library/LaunchAgents/com.logseq.daily-automation.plist
# Edit the file to replace /path/to/ with your actual paths
```

2. Load launchd agent:
```bash
launchctl load ~/Library/LaunchAgents/com.logseq.daily-automation.plist
```

3. Test manually:
```bash
./run-daily-automation.sh
```

Generated template structure:
```markdown
- [[일기]]
  - [[날씨]]
    - {weather info}
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

See [Korean README](README.ko.md) for more details.

### Cultural Content Structure

`add_book`, `add_movie`, `add_exhibition` tools use Korean wikilink structure (`[[문화]]`). Customize the templates in `src/index.ts` for your language.

---

## Development

```bash
# Install dependencies
npm ci

# Development mode (watch)
npm run dev

# TypeScript build
npm run build

# Run regression tests
npm test

# Check npm package contents
npm pack --dry-run

# Production run
npm start
```

### Project Structure

```
src/
  index.ts    # MCP server entry point, tool handlers
  types.ts    # TypeScript type definitions
  graph.ts    # Graph filesystem operations
```

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
for setup, testing, and contribution guidelines.

### Ideas for contribution

- [ ] org-mode support
- [ ] Logseq property search
- [ ] Whiteboard support
- [ ] Better graph visualization data
- [ ] i18n for templates

---

## License

[MIT](LICENSE)

---

## Related

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Logseq](https://logseq.com/)
- [Codex](https://developers.openai.com/codex/)
- [Claude Code](https://claude.ai/code)
