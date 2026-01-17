# Wingman

A lightweight, cross-platform text composition tool that provides a floating overlay for quick text editing with clipboard integration.

## What is Wingman?

Wingman is a desktop application that lets you quickly compose multi-line text before pasting it anywhere. Press a global hotkey, type your text with full editing capabilities, and copy it to clipboard with a single command.

### Key Use Cases

- **Quick Code Snippets**: Compose code before pasting into terminals, chat apps, or documentation
- **Email/Message Drafts**: Write longer messages before pasting into email clients or messaging apps
- **Text Transformations**: Quickly transform text (uppercase, sort lines, remove duplicates)
- **Snippet Library**: Save frequently used text templates for quick access

## Features

### Core Editing
- Multi-line text editing with full cursor control
- Syntax highlighting for common languages
- Auto-focus on text area when window opens
- Frameless, always-on-top floating window
- Semi-transparent background with blur effects
- Text persists when closing window (until you copy)

### Advanced Features
- **History**: Last 100 composed drafts with search/filter and keyboard navigation
- **Snippets**: Save and quickly insert frequently-used text templates
- **Themes**: Dark mode, light mode, and high contrast
- **Statistics**: Real-time character/word/line count
- **Quick Actions**: Transform text (uppercase, lowercase, sort, deduplicate)
- **Customization**: Hotkey, font, opacity, and more

## Installation

### Download

Download the latest release for your platform from the [Releases page](https://github.com/charliesteenhagen-wk/wingman/releases):

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
git clone https://github.com/charliesteenhagen-wk/wingman.git
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
2. A floating window appears - start typing
3. Use mouse or keyboard to edit freely
4. Press `Cmd/Ctrl+Enter` to copy to clipboard and close (then paste with `Cmd/Ctrl+V`)
5. Press `ESC` to close without copying (text is preserved)
6. Click outside the window to close (text is preserved)

### Keyboard Shortcuts

#### Global
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+Space` | Show/hide Wingman (configurable) |

#### Editor
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Enter` | Copy to clipboard, close, and return to previous app |
| `ESC` | Close panel (if open) or close window without copying |
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+H` | Toggle history panel |
| `Cmd/Ctrl+K` | Toggle snippets panel |
| `Cmd/Ctrl+Shift+A` | Quick actions menu |
| `Cmd/Ctrl+N` | Clear editor |
| `Cmd/Ctrl+Shift+U` | Transform to uppercase |
| `Cmd/Ctrl+Shift+L` | Transform to lowercase |

#### History Panel
| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate through history entries |
| `Enter` | Load selected entry into editor |
| Type any character | Focus search and start filtering |

#### Snippets Panel
| Shortcut | Action |
|----------|--------|
| Click snippet | Insert snippet content into editor |
| `Enter` / `Space` | Insert focused snippet |

### Tips

- **Resize the window** by dragging the edges or corners
- **Move the window** by dragging the title bar
- Window position and size are remembered between sessions
- Use snippets for frequently typed text like email signatures or code templates
- Text is preserved when you close without pasting - it'll be there next time you open Wingman

## Configuration

Settings are stored in:
- **macOS**: `~/Library/Application Support/com.wingman.app/`
- **Windows**: `%APPDATA%\com.wingman.app\`
- **Linux**: `~/.local/share/com.wingman.app/`

### Settings Include:
- Global hotkey customization
- Theme (dark/light/high contrast)
- Font family and size
- Window opacity
- Editor preferences (tab size, line wrap, line numbers)
- History settings (max entries)

## Privacy

Wingman is privacy-first:
- **No analytics or telemetry** - your data never leaves your machine
- **All data stored locally** - settings, history, and snippets are stored in local files
- **Works completely offline** - no internet connection required

## Development

### Project Structure

```
wingman/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs        # Application entry
│   │   ├── lib.rs         # Tauri commands
│   │   ├── hotkey.rs      # Hotkey utilities
│   │   ├── clipboard.rs   # Text utilities
│   │   ├── storage.rs     # Settings & snippets storage
│   │   ├── history.rs     # SQLite history management
│   │   └── window.rs      # macOS NSPanel for fullscreen overlay
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand state stores
│   └── types/             # TypeScript types
├── package.json
└── tailwind.config.js
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Editor**: CodeMirror 6
- **State Management**: Zustand
- **Backend**: Rust with Tauri 2.x
- **Storage**: SQLite (history), JSON files (settings, snippets)

### Building

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Cross-platform desktop app framework
- [CodeMirror](https://codemirror.net/) - Extensible code editor
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
