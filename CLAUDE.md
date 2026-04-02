# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Quick Start

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run in development mode (watch + rebuild)
bun run dev

# Run the built CLI
bun run dist/cli.js

# Run tests
bun test

# Lint and format
bun run lint        # Biome lint
bun run lint:fix    # Auto-fix
bun run format      # Biome format --write

# Health check (verifies build output)
bun run health
```

## Project Overview

This is a reverse-engineered version of Anthropic's Claude Code CLI — an interactive AI coding assistant for the terminal. The project uses:

- **Runtime**: Bun >= 1.2.0
- **Language**: TypeScript 6.0+
- **UI Framework**: React 19 with custom Ink renderer (React Reconciler for Terminal)
- **Layout**: Facebook Yoga (Flexbox for terminal)
- **Architecture**: Monorepo with workspace packages

## Architecture

```
src/
├── main.tsx              # Main entry point with fast-path detection
├── entrypoints/          # CLI command handlers
├── bootstrap/            # Initialization (config, telemetry, graceful shutdown)
├── ink/                  # Terminal rendering engine (React Reconciler)
│   ├── reconciler.ts     # Custom host config for terminal
│   ├── renderer.ts       # Render pipeline
│   ├── termio/           # ANSI escape sequence handling
│   └── components/       # Terminal UI primitives
├── state/                # AppState store (lightweight pub/sub)
├── tools/                # Tool implementations (Bash, FileRead, Grep, etc.)
├── tasks/                # Task system (LocalShellTask, LocalAgentTask, etc.)
├── commands/             # Slash commands and keybindings
├── services/             # API clients (Anthropic, AWS, Azure, Google)
├── bridge/               # Remote bridge layer
└── remote/               # Remote session management
```

## Build System

The build uses Bun's built-in build API:

- **Entry**: `src/main.tsx` → `dist/cli.js`
- **Config**: `build.ts` handles bundling with macro definitions
- **Dev Mode**: `scripts/dev.ts` watches for changes and rebuilds
- **Health Check**: `scripts/health-check.ts` verifies build output

Key build features:
- Feature flags via `bun:bundle` for dead code elimination
- Macro inlining for version/build metadata
- External native modules (`.node` files)

## State Management

Custom lightweight store pattern (~30 lines):

```typescript
// State updates use immutable pattern
setAppState(prev => ({ ...prev, field: newValue }))

// Subscribe with selectors via useSyncExternalStore
const value = useAppState(state => state.someField)
```

Modules:
- `src/state/AppState.tsx` - Main state definitions
- `src/state/store.ts` - Core store implementation
- `src/bootstrap/state.ts` - Global state accessors

## Tool System

All tools implement the `Tool` interface (`src/Tool.ts`):

```typescript
type Tool<Input, Output, Progress> = {
  name: string
  inputSchema: ZodSchema
  call(args, context, onProgress): Promise<ToolResult<Output>>
  validateInput(input, context): Promise<ValidationResult>
  checkPermissions(input, context): Promise<PermissionResult>
  // ... more methods
}
```

Tool categories:
- **File**: FileReadTool, FileEditTool, FileWriteTool
- **Search**: GrepTool, GlobTool
- **Shell**: BashTool, PowerShellTool
- **Network**: WebFetchTool, WebSearchTool
- **Task**: TaskCreateTool, TaskGetTool, TaskUpdateTool
- **MCP**: ListMcpResourcesTool, ReadMcpResourceTool

## Task System

Unified task management with strategy pattern:

| Type | Prefix | Purpose |
|------|--------|---------|
| `local_bash` | `b` | Local shell commands |
| `local_agent` | `a` | Local agents (sub-agents) |
| `remote_agent` | `r` | Remote Claude.ai sessions |
| `in_process_teammate` | `t` | In-process teammates (Swarm) |

## Key Commands

```bash
# Run single test
bun test path/to/test.ts

# Check for unused code
bun run check:unused  # knip

# Development docs
bun run docs:dev  # Mintlify
```

## Monorepo Packages

Internal workspace packages in `packages/`:

| Package | Purpose |
|---------|---------|
| `@ant/claude-for-chrome-mcp` | Chrome MCP integration |
| `@ant/computer-use-*` | Computer vision modules |
| `*-napi` | Native N-API modules (audio, color, image) |

## Configuration

- **TypeScript**: `tsconfig.json` - ESNext, React JSX, Bun types, `src/*` path alias
- **Biome**: Linting and formatting (replaces ESLint + Prettier)
- **Git Hooks**: Configured via `.githooks/` directory

## Important Patterns

### Fast-Path Detection

The CLI entry point checks for quick commands before loading heavy modules:

```typescript
// In main.tsx - zero module loading
if (args.length === 1 && args[0] === '--version') {
  console.log(`${MACRO.VERSION} (Claude Code)`)
  return
}
```

### Startup Optimization

Parallel prefetching at startup:

```typescript
// In main.tsx - before heavy imports
startMdmRawRead()      // MDM config subprocess
startKeychainPrefetch() // macOS keychain credentials
```

### Feature Flags

Conditional code loading via Bun's feature API:

```typescript
import { feature } from 'bun:bundle'

if (feature('BRIDGE_MODE')) {
  // Bridge mode code (DCE'd if disabled)
}
```

## Testing

Tests use Bun's built-in test runner. Run all tests with:

```bash
bun test
```

## Security Notes

This codebase contains:
- Multi-layer permission system for tool execution
- Static rules, permission pipelines, AI classifiers
- Hooks system (PreToolUse, PostToolUse)
- mTLS and credential management

When modifying security-sensitive code (auth, permissions, file access), ensure all layers remain intact.

## External Dependencies

Key SDKs:
- `@anthropic-ai/sdk` - Anthropic API
- `@anthropic-ai/bedrock-sdk` - AWS Bedrock
- `@anthropic-ai/vertex-sdk` - Google Vertex
- `@modelcontextprotocol/sdk` - MCP protocol
- `@aws-sdk/*` - AWS clients
- `@azure/identity` - Azure auth
- `google-auth-library` - Google auth

## Troubleshooting

### Build fails
- Check Bun version: `bun --version` (must be >= 1.2.0)
- Clear node_modules: `rm -rf node_modules && bun install`
- Check build output: `ls -la dist/`

### Runtime errors
- Check health: `bun run health`
- Enable verbose mode: `--verbose` flag
- Check config: `~/.claude/config.json`

### Type errors
- TypeScript is for type-checking only (`noEmit: true`)
- Bun handles the actual compilation
- Run `tsc --noEmit` to verify types
