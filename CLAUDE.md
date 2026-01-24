# Wingman

Tauri 2.x desktop app for developer text transformation. Spotlight-style UI triggered by global hotkey.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri commands)
- **Services**: Supabase (auth/DB), Stripe (licensing), Anthropic (AI)

## Architecture

```
src/
├── components/     # React UI
├── hooks/          # Custom hooks
├── lib/            # Utilities, API clients
├── transformers/   # Text transformation logic
src-tauri/src/
├── commands/       # Tauri IPC commands
├── lib.rs          # Main Tauri setup
```

## Key Patterns

- **Tauri IPC**: All system ops (clipboard, hotkeys, windows) via Rust commands. No browser APIs.
- **Transformations**: Pure functions returning `{ result: string, error?: string }`
- **Tiers**: Check `userTier` from license context. Values: `free`, `pro`, `premium`
- **State**: React context for global (license, settings), local for component UI

## Commands

```bash
pnpm tauri dev      # Dev server
pnpm tauri build    # Production build
pnpm build          # Type check + Vite build
pnpm lint           # ESLint
```

## Guidelines

- Functional components, hooks over classes
- Explicit TypeScript types, no `any`
- Error boundaries around AI/network features
- Tauri commands return `Result<T, String>`
- Access Supabase through hooks/lib, not directly from components
- No secrets in frontend code
- Justify new dependencies