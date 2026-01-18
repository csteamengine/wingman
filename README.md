<p align="center">
  <img src="icons/icon-128.png" alt="Wingman Logo" width="128" height="128">
</p>

# Wingman

A lightweight, cross-platform developer toolkit that provides a spotlight-style overlay for quick access to essential development utilities.

## What is Wingman?

Wingman is a desktop application that gives you instant access to developer tools through a global hotkey. Press the shortcut and get a powerful overlay with JSON/XML formatting, text scratchpads with syntax highlighting, snippet recording, and all the features from Niblet—without ever leaving your current workspace.

### Key Use Cases

- **JSON/XML Validation & Formatting**: Quickly validate and beautify JSON or XML with syntax highlighting
- **Code Scratchpad**: Multi-language syntax-highlighted scratch space for testing snippets
- **Snippet Recording**: Capture and replay frequently-used code patterns
- **Quick Text Transformations**: Convert case, sort lines, remove duplicates, encode/decode
- **Clipboard Management**: Advanced clipboard history and manipulation
- **Developer Utilities**: Color picker, hash generator, regex tester, base64 encoding, and more

## Features

### Core Tools

- **JSON/XML Validator & Formatter**: Paste messy JSON/XML and get beautifully formatted, validated output
- **Multi-Language Scratchpad**: Code editor with syntax highlighting for 20+ languages
- **Snippet Library**: Save, organize, and quickly insert code snippets
- **Clipboard History**: Access your last 100 clipboard items with search
- **Text Transformations**:
    - Case conversion (camelCase, snake_case, UPPERCASE, etc.)
    - Line operations (sort, deduplicate, reverse)
    - Encode/decode (Base64, URL, HTML entities)
    - Hash generation (MD5, SHA-256)

### Niblet Features

- **Regex Tester**: Live pattern testing with match highlighting
- **Color Picker**: Advanced color selection with format conversion (HEX, RGB, HSL, etc.)
- **Unit Converter**: Convert between units with developer-friendly formats
- **UUID Generator**: Generate v4 UUIDs instantly
- **Timestamp Converter**: Unix timestamp to human-readable and vice versa
- **Lorem Ipsum Generator**: Placeholder text, JSON, or code snippets

### Interface

- Spotlight-style overlay that appears over any application
- Frameless, always-on-top floating window
- Semi-transparent background with blur effects
- Fast keyboard navigation
- Theme support (dark mode, light mode, high contrast)

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