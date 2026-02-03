<p align="center">
  <img src="icons/icon-128.png" alt="Wingman Logo" width="128" height="128">
</p>

<p align="center">
  <a href="https://github.com/sponsors/csteamengine"><img src="https://img.shields.io/badge/Sponsor-❤-ea4aaa?style=for-the-badge&logo=github" alt="Sponsor on GitHub"></a>
</p>

# Wingman

A lightweight, cross-platform developer toolkit that provides a spotlight-style overlay for quick access to essential development utilities.

## What is Wingman?

Wingman is a desktop application that gives you instant access to developer tools through a global hotkey. Press the shortcut and get a powerful overlay with a code editor, text transformations, AI refinement, and more—without ever leaving your current workspace.

### Key Use Cases

- **Quick Text Transformations**: Convert case, sort lines, remove duplicates, bullet/numbered lists
- **Code Scratchpad**: Scratch space with syntax highlighting for 20+ languages
- **Developer Utilities**: UUID generator, Lorem Ipsum generator, hash generators, encode/decode tools
- **Code Formatting** *(Pro)*: Format and minify JSON, XML, HTML, CSS, JavaScript, Python, and more
- **Clipboard Management** *(Pro)*: Clipboard history with search and drag-and-drop support
- **Snippet Library** *(Pro)*: Save, organize, search, and tag reusable code snippets
- **AI Text Refinement** *(Premium)*: Transform text with AI-powered presets for emails, commits, code review, and more

## Features

### Free Features

Everything you need for quick text manipulation:

- **Text Scratchpad**: CodeMirror-based code editor for quick text work
- **Text Transformations**:
    - Case conversion (UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, kebab-case)
    - Line operations (sort, deduplicate, reverse)
    - Trim whitespace and remove empty lines
    - Bullet list and numbered list formatting
    - Custom transformations (write your own JavaScript/TypeScript transforms)
    - Transformation chains: combine multiple transforms into a single action
- **Generators**:
    - UUID v4 & v7 generators
    - NanoID generator (compact URL-safe IDs)
    - Short hash & prefixed ID generators
    - Bulk ID generation (up to 100 at once)
    - Lorem Ipsum generator (configurable paragraphs)
    - Hash generators (MD5, SHA-1, SHA-256, SHA-512)
    - Unix/human timestamp conversion
- **Export Options**:
    - Copy to clipboard with keyboard shortcut (⌘↵)
    - Save to file with native OS file picker
    - Copy as file to clipboard
    - Export split button with remembered last action
- **Interface**:
    - Spotlight-style overlay that appears over any application
    - Global hotkey activation (configurable)
    - Configurable font family, size, and opacity
    - System tray integration
    - Focus mode (fill-screen without fullscreen)
    - Sticky mode (keep window visible across spaces)
    - Window position remembered per monitor

### Pro Features

Unlock the full power of Wingman:

- **Image & File Attachments**: Drag and drop images and files to include with your text—paste them together anywhere
- **Multi-Language Scratchpad**: Syntax highlighting for 20+ languages (JavaScript, TypeScript, Python, Rust, Go, Java, React/JSX, and more)
- **Obsidian-Style Markdown Editing**:
    - Live preview with syntax hiding (bold, italic, strikethrough, inline code)
    - Headers (H1-H6), blockquotes, horizontal rules
    - Links and images with inline preview
    - Bullet list rendering with dot widgets
    - Fenced code blocks with syntax highlighting
    - Cursor reveals syntax for editing, hides when moving away
- **Code Formatting & Minification**: Format and minify JSON, XML, HTML, CSS, JavaScript, TypeScript, Python, SQL, Go, Rust, Java, PHP, Ruby, Swift, Kotlin, C#, C/C++, Bash, Markdown
- **Diff Preview**: Review text transformations before applying, with undo support
- **Encode/Decode Tools**:
    - Base64 encode/decode
    - URL encode/decode
    - HTML entity encode/decode
- **Clipboard History**: Access clipboard history with search and drag-drop reordering
- **Export History**: Export clipboard history to JSON
- **Snippet Library**: Save, organize, search, and tag your code snippets
- **Stats Display**: Character, word, and line count
- **Custom Themes**: Dark, Light, High Contrast, Solarized Dark/Light, Dracula, Nord
- **Obsidian Integration**: Send notes directly to your Obsidian vault
- **GitHub Gist Integration**: Create GitHub Gists directly from the editor
- **Copy as File**: Copy editor content as a file to the system clipboard
- **Colorblind Mode**: Accessible color scheme option

### Premium Features

For power users who want AI assistance:

- **AI Text Refinement**: Transform rough text into polished content with built-in presets:
    - Ask AI (general Q&A)
    - General refinement (copy editing)
    - Email formatting
    - Slack message optimization
    - Claude Code prompt optimization
    - Git commit messages (conventional commits)
    - Jira/ticket formatting
    - Code review comments
    - Documentation generation
    - PR descriptions
    - TL;DR summaries
    - Stack trace parsing and explanation
- **Code Explainer**: AI-powered code explanations with:
    - Markdown-formatted output with fenced code blocks
    - Syntax highlighting for the detected language
    - Granular breakdown of functions, loops, conditionals
    - Educational explanations for each code section
- **Custom AI Prompts**: Create your own AI presets with custom system prompts

## Installation

### Download

Download the latest release for your platform from the [Releases page](https://github.com/yourusername/wingman/releases):

- **macOS (Apple Silicon)**: `Wingman_*_aarch64.dmg`
- **macOS (Intel)**: `Wingman_*_x64.dmg`
- **Windows**: `Wingman_*_x64-setup.exe` or `.msi`
- **Linux**: `Wingman_*_amd64.deb` or `.AppImage`

#### macOS: "App is damaged" warning

Since Wingman is not signed with an Apple Developer certificate, macOS will show a warning that the app "is damaged and can't be opened." To fix this:

1. Open Terminal
2. Run: `xattr -cr /Applications/Wingman.app`
3. Now you can open Wingman normally

Alternatively, you can right-click the app and select "Open" instead of double-clicking.

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.77+
- Platform-specific dependencies (see [Tauri prerequisites](https://tauri.app/start/prerequisites/))

#### Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/wingman.git
cd wingman

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Usage

### Basic Workflow

1. Press the global hotkey (default: `Cmd+Shift+Space` on Mac, `Ctrl+Shift+Space` on Windows/Linux)
2. A spotlight-style overlay appears over your current workspace
3. Start typing or paste content into the editor
4. Use toolbar buttons for transformations, formatting, or AI refinement
5. Press `⌘↵` to copy to clipboard and paste to previous app, or use the export split button
6. Press `ESC` to close and return to your work

### Keyboard Shortcuts

#### Global
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+Space` | Show/hide Wingman (configurable) |

#### Editor Actions
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Enter` | Copy to clipboard and paste to previous app |
| `ESC` | Close Wingman |
| `Cmd/Ctrl+,` | Open settings |

### Tips

- **Language auto-detection** works when formatting—select a language mode or let Wingman detect it
- Window position and size are remembered per monitor between sessions
- All tools work completely offline—no internet required (except AI features and GitHub Gist)
- Use the export split button dropdown to switch between Save to File, Obsidian, GitHub Gist, and Copy as File

## Configuration

Settings are stored in:
- **macOS**: `~/Library/Application Support/com.wingman.app/`
- **Windows**: `%APPDATA%\com.wingman.app\`
- **Linux**: `~/.local/share/com.wingman.app/`

### Customizable Settings

- Global hotkey
- Theme (Dark, Light, High Contrast, Solarized Dark/Light, Dracula, Nord)
- Font family and size
- Window opacity and blur
- Sticky mode (keep visible across spaces)
- Diff preview for transformations
- Default export action
- Colorblind mode

## Privacy

Wingman is privacy-first:
- **No analytics or telemetry** - your data never leaves your machine
- **All data stored locally** - settings, history, and snippets are stored in local files
- **Works completely offline** - no internet connection required (except AI and GitHub features)

## Development

### Project Structure

```
wingman/
├── src-tauri/              # Rust backend
│   └── src/
│       ├── main.rs         # Application entry
│       ├── lib.rs          # Tauri commands
│       ├── hotkey.rs       # Global hotkey management
│       ├── clipboard.rs    # Clipboard & text utilities
│       ├── native_clipboard.rs # Native clipboard (files, images)
│       ├── formatters.rs   # Code formatting & minification
│       ├── storage.rs      # Settings & snippets storage
│       ├── history.rs      # Clipboard history (SQLite)
│       ├── premium.rs      # AI, Obsidian integration
│       ├── github.rs       # GitHub Gist integration
│       ├── license.rs      # License management
│       └── window.rs       # Overlay window management (macOS)
├── src/                    # React frontend
│   ├── components/
│   │   ├── editor/         # Editor components (toolbar, action buttons, etc.)
│   │   ├── EditorWindow.tsx
│   │   ├── HistoryPanel.tsx
│   │   ├── SnippetsPanel.tsx
│   │   └── SettingsPanel.tsx
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand state stores
│   ├── data/               # AI presets, constants
│   └── types/              # TypeScript types
├── package.json
└── tailwind.config.js
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Editor**: CodeMirror 6 with language support
- **State Management**: Zustand
- **Backend**: Rust with Tauri 2.x
- **Storage**: SQLite (history), JSON files (settings, snippets)
- **Icons**: Lucide React

### Building

```bash
# Development
pnpm tauri dev

# Production build
pnpm tauri build

# Type check
pnpm build

# Lint
pnpm lint
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Reporting Issues

- Use GitHub Issues to report bugs
- Include your OS version and Wingman version
- Provide steps to reproduce the issue
- For tool-specific bugs, include sample input that triggers the issue

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Cross-platform desktop app framework
- [CodeMirror](https://codemirror.net/) - Extensible code editor
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Lucide](https://lucide.dev/) - Icon library
- Inspired by [Raycast](https://raycast.com/), [Alfred](https://www.alfredapp.com/), and developer productivity tools
