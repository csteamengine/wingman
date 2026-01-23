<p align="center">
  <img src="icons/icon-128.png" alt="Wingman Logo" width="128" height="128">
</p>

# Wingman

A lightweight, cross-platform developer toolkit that provides a spotlight-style overlay for quick access to essential development utilities.

## What is Wingman?

Wingman is a desktop application that gives you instant access to developer tools through a global hotkey. Press the shortcut and get a powerful overlay with JSON/XML formatting, text scratchpads with syntax highlighting, snippet recording, and more—without ever leaving your current workspace.

### Key Use Cases

- **Quick Text Transformations**: Convert case, sort lines, remove duplicates
- **Code Scratchpad**: Scratch space for testing snippets and quick edits
- **Developer Utilities**: UUID generator, Lorem Ipsum generator
- **JSON/XML Formatting** *(Pro)*: Quickly validate and beautify JSON or XML
- **Clipboard Management** *(Pro)*: Advanced clipboard history and manipulation
- **Snippet Recording** *(Pro)*: Capture and replay frequently-used code patterns

## Features

### Free Features

Everything you need for quick text manipulation:

- **Text Scratchpad**: Simple code editor for quick text work
- **Text Transformations**:
    - Case conversion (UPPERCASE, lowercase, Title Case, Sentence case)
    - Line operations (sort, deduplicate, reverse)
    - Trim whitespace
- **Generators**:
    - UUID v4 generator
    - Lorem Ipsum generator (1, 3, or 5 paragraphs)
- **Interface**:
    - Spotlight-style overlay that appears over any application
    - Global hotkey activation (configurable)
    - Copy to clipboard with keyboard shortcut
    - Customizable font family, size, and opacity
    - System tray integration

### Pro Features

Unlock the full power of Wingman:

- **Image & File Attachments**: Drag and drop images and files to include with your text—paste them together anywhere
- **Multi-Language Scratchpad**: Syntax highlighting for 20+ languages (JavaScript, TypeScript, Python, Rust, Go, Java, and more)
- **Obsidian-Style Markdown Editing**:
    - Live preview with syntax hiding (bold, italic, strikethrough, inline code)
    - Headers (H1-H6), blockquotes, horizontal rules
    - Links and images with inline preview
    - Fenced code blocks with syntax highlighting
    - Cursor reveals syntax for editing, hides when moving away
- **JSON/XML Formatter**: Pretty-print and minify JSON, format XML with proper indentation
- **Encode/Decode Tools**:
    - Base64 encode/decode
    - URL encode/decode
    - HTML entity encode/decode
- **Clipboard History**: Access your clipboard history with search and drag-drop support
- **Export History**: Export clipboard history to JSON
- **Snippet Library**: Save, organize, search, and tag your code snippets
- **Stats Display**: Character, word, and line count
- **Custom Themes**: Dark, Light, High Contrast, Solarized Dark/Light, Dracula, Nord
- **Obsidian Integration**: Send notes directly to your Obsidian vault

### Premium Features

For power users who want AI assistance:

- **AI Text Refinement**: Transform rough text into polished content
    - Email formatting
    - Slack message optimization
    - Git commit messages
    - Jira/ticket formatting
    - Code review comments
    - Documentation generation
    - PR descriptions
    - TL;DR summaries
- **Code Explainer**: AI-powered code explanations with:
    - Markdown-formatted output with fenced code blocks
    - Syntax highlighting for the detected language
    - Granular breakdown of functions, loops, conditionals
    - Educational explanations for each code section

### Coming Soon

- **Hash Generation**: MD5, SHA-256 *(coming soon)*
- **Regex Tester**: Live pattern testing with match highlighting *(coming soon)*
- **Timestamp Converter**: Unix timestamp to human-readable and vice versa *(coming soon)*

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
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Usage

### Basic Workflow

1. Press the global hotkey (default: `Cmd+Shift+Space` on Mac, `Ctrl+Shift+Space` on Windows/Linux)
2. A spotlight-style overlay appears over your current workspace
3. Start typing to search tools, or use keyboard shortcuts to jump directly to utilities
4. Use the tool you need (format JSON, grab a snippet, check regex, etc.)
5. Press `ESC` to close and return to your work
6. Results are automatically copied to clipboard when appropriate

### Keyboard Shortcuts

#### Global
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+Space` | Show/hide Wingman (configurable) |

#### Navigation
| Shortcut | Action |
|----------|--------|
| `ESC` | Close Wingman |
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+K` | Command palette / tool search |
| `Cmd/Ctrl+1-9` | Jump to tool by number |

#### Tool Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+J` | Open JSON formatter |
| `Cmd/Ctrl+R` | Open regex tester |
| `Cmd/Ctrl+P` | Open color picker |
| `Cmd/Ctrl+S` | Open scratchpad |
| `Cmd/Ctrl+H` | Open clipboard history |
| `Cmd/Ctrl+B` | Open snippet library |

#### Editor Actions
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Enter` | Format/execute (context-dependent) |
| `Cmd/Ctrl+Shift+C` | Copy result to clipboard |
| `Cmd/Ctrl+N` | Clear current tool |
| `Cmd/Ctrl+Shift+F` | Auto-format code |

### Quick Tool Access

Type these prefixes in the command palette for instant access:

- `json` - JSON formatter
- `xml` - XML formatter
- `regex` - Regex tester
- `color` - Color picker
- `hash` - Hash generator
- `base64` - Base64 encoder/decoder
- `uuid` - UUID generator
- `time` - Timestamp converter
- `lorem` - Lorem ipsum generator

### Tips

- **Use the command palette** (`Cmd/Ctrl+K`) to quickly search and navigate between tools
- **Scratchpad auto-detects language** from file extensions or content
- **Snippets sync** across all your devices (optional)
- **JSON/XML validator** shows errors inline with line numbers
- All tools work completely offline—no internet required
- Window position and size are remembered between sessions

## Configuration

Settings are stored in:
- **macOS**: `~/Library/Application Support/com.wingman.app/`
- **Windows**: `%APPDATA%\com.wingman.app\`
- **Linux**: `~/.local/share/com.wingman.app/`

### Customizable Settings

- Global hotkey
- Theme (dark/light/high contrast)
- Font family and size
- Window opacity and blur
- Default tool on launch
- Clipboard history size
- Snippet sync (optional cloud storage)
- Tool-specific preferences (regex flags, color format defaults, etc.)

## Privacy

Wingman is privacy-first:
- **No analytics or telemetry** - your data never leaves your machine
- **All data stored locally** - settings, history, and snippets are stored in local files
- **Works completely offline** - no internet connection required
- **Optional sync** - enable cloud sync for snippets only if you want it

## Development

### Project Structure

```
wingman/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs        # Application entry
│   │   ├── lib.rs         # Tauri commands
│   │   ├── hotkey.rs      # Global hotkey management
│   │   ├── clipboard.rs   # Clipboard utilities
│   │   ├── storage.rs     # Settings & snippets storage
│   │   ├── history.rs     # Clipboard history (SQLite)
│   │   ├── window.rs      # Overlay window management
│   │   └── tools/         # Tool-specific utilities
│   │       ├── json.rs    # JSON validation/formatting
│   │       ├── xml.rs     # XML validation/formatting
│   │       ├── regex.rs   # Regex testing
│   │       ├── hash.rs    # Hash generation
│   │       └── encoder.rs # Base64, URL encoding
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React frontend
│   ├── components/
│   │   ├── CommandPalette/
│   │   ├── Tools/         # Individual tool components
│   │   │   ├── JSONFormatter/
│   │   │   ├── Scratchpad/
│   │   │   ├── SnippetLibrary/
│   │   │   ├── RegexTester/
│   │   │   └── ...
│   │   └── shared/
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand state stores
│   └── types/             # TypeScript types
├── package.json
└── tailwind.config.js
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Editor**: CodeMirror 6 with language support
- **State Management**: Zustand
- **Backend**: Rust with Tauri 2.x
- **Storage**: SQLite (history), JSON files (settings, snippets)
- **Parsing**: serde_json (JSON), quick-xml (XML)

### Building

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Run tests
npm test
cargo test
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

## Potential Roadmap

- [ ] Diff tool for comparing text/code
- [ ] CSV/TSV formatter and analyzer
- [ ] SQL formatter and query builder
- [ ] Markdown preview
- [ ] Image optimization tool
- [ ] JWT decoder
- [ ] Mock data generator

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Cross-platform desktop app framework
- [CodeMirror](https://codemirror.net/) - Extensible code editor
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- Inspired by [Raycast](https://raycast.com/), [Alfred](https://www.alfredapp.com/), and developer productivity tools