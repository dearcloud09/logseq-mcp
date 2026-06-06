# Security Policy

`logseq-mcp` gives AI assistants read and write access to a local Logseq graph.
Treat the configured graph path as sensitive.

## Supported Versions

Security fixes are currently provided for the latest release.

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that could expose private
notes, local files, or credentials.

Report issues by emailing the maintainer or opening a private GitHub security
advisory if that option is available. Include:

- affected version or commit
- operating system
- configured `LOGSEQ_GRAPH_PATH`
- reproduction steps using a minimal test graph
- expected and actual behavior

## Security Model

The server is intended to:

- access only the configured Logseq graph
- read and write only Markdown pages in `pages/` and `journals/`
- reject path traversal outside the graph
- reject symbolic links and hardlinks
- limit input and content sizes
- sanitize filesystem error messages before returning them to MCP clients

The server does not:

- authenticate MCP clients
- encrypt local notes
- protect against an already-compromised MCP client
- support remote multi-user hosting

Run it only with MCP clients you trust.
