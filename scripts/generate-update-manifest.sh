#!/bin/bash
# Generate update manifest (latest.json) from Tauri build artifacts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Wingman Update Manifest Generator${NC}"
echo "=================================="

# Get version from Cargo.toml
VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
echo -e "Version: ${YELLOW}$VERSION${NC}"

# Get current date in ISO 8601 format
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Publish date: $PUB_DATE"

# Prompt for release notes
echo ""
echo "Enter release notes (press Ctrl+D when done):"
NOTES=$(cat)

# Bundle directory
BUNDLE_DIR="src-tauri/target/release/bundle"

# Check if bundle directory exists
if [ ! -d "$BUNDLE_DIR" ]; then
    echo -e "${RED}Error: Bundle directory not found. Run 'pnpm tauri build' first.${NC}"
    exit 1
fi

# Function to read signature file
read_signature() {
    local sig_file="$1"
    if [ -f "$sig_file" ]; then
        cat "$sig_file"
    else
        echo "SIGNATURE_NOT_FOUND_${sig_file}"
    fi
}

# Find signature files
echo ""
echo "Looking for signature files..."

MACOS_AARCH64_SIG=""
MACOS_X64_SIG=""
WINDOWS_X64_SIG=""
LINUX_AMD64_SIG=""

# macOS signatures
if [ -f "$BUNDLE_DIR/macos/Wingman_aarch64.app.tar.gz.sig" ]; then
    MACOS_AARCH64_SIG=$(read_signature "$BUNDLE_DIR/macos/Wingman_aarch64.app.tar.gz.sig")
    echo -e "${GREEN}✓${NC} Found macOS ARM64 signature"
fi

if [ -f "$BUNDLE_DIR/macos/Wingman_x64.app.tar.gz.sig" ]; then
    MACOS_X64_SIG=$(read_signature "$BUNDLE_DIR/macos/Wingman_x64.app.tar.gz.sig")
    echo -e "${GREEN}✓${NC} Found macOS x64 signature"
fi

# Windows signature
if [ -f "$BUNDLE_DIR/nsis/Wingman_x64-setup.nsis.zip.sig" ]; then
    WINDOWS_X64_SIG=$(read_signature "$BUNDLE_DIR/nsis/Wingman_x64-setup.nsis.zip.sig")
    echo -e "${GREEN}✓${NC} Found Windows x64 signature"
fi

# Linux signature
if [ -f "$BUNDLE_DIR/appimage/wingman_amd64.AppImage.tar.gz.sig" ]; then
    LINUX_AMD64_SIG=$(read_signature "$BUNDLE_DIR/appimage/wingman_amd64.AppImage.tar.gz.sig")
    echo -e "${GREEN}✓${NC} Found Linux x64 signature"
fi

# Generate latest.json
OUTPUT_FILE="latest.json"

cat > "$OUTPUT_FILE" <<EOF
{
  "version": "$VERSION",
  "notes": "$NOTES",
  "pub_date": "$PUB_DATE",
  "platforms": {
EOF

# Add platform entries (only if signature exists)
FIRST=true

if [ -n "$MACOS_AARCH64_SIG" ]; then
    if [ "$FIRST" = false ]; then echo "," >> "$OUTPUT_FILE"; fi
    cat >> "$OUTPUT_FILE" <<EOF
    "darwin-aarch64": {
      "signature": "$MACOS_AARCH64_SIG",
      "url": "https://github.com/csteamengine/wingman/releases/download/v$VERSION/Wingman_aarch64.app.tar.gz"
    }
EOF
    FIRST=false
fi

if [ -n "$MACOS_X64_SIG" ]; then
    if [ "$FIRST" = false ]; then echo "," >> "$OUTPUT_FILE"; fi
    cat >> "$OUTPUT_FILE" <<EOF
    "darwin-x86_64": {
      "signature": "$MACOS_X64_SIG",
      "url": "https://github.com/csteamengine/wingman/releases/download/v$VERSION/Wingman_x64.app.tar.gz"
    }
EOF
    FIRST=false
fi

if [ -n "$WINDOWS_X64_SIG" ]; then
    if [ "$FIRST" = false ]; then echo "," >> "$OUTPUT_FILE"; fi
    cat >> "$OUTPUT_FILE" <<EOF
    "windows-x86_64": {
      "signature": "$WINDOWS_X64_SIG",
      "url": "https://github.com/csteamengine/wingman/releases/download/v$VERSION/Wingman_x64-setup.nsis.zip"
    }
EOF
    FIRST=false
fi

if [ -n "$LINUX_AMD64_SIG" ]; then
    if [ "$FIRST" = false ]; then echo "," >> "$OUTPUT_FILE"; fi
    cat >> "$OUTPUT_FILE" <<EOF
    "linux-x86_64": {
      "signature": "$LINUX_AMD64_SIG",
      "url": "https://github.com/csteamengine/wingman/releases/download/v$VERSION/wingman_amd64.AppImage.tar.gz"
    }
EOF
    FIRST=false
fi

# Close JSON
cat >> "$OUTPUT_FILE" <<EOF

  }
}
EOF

echo ""
echo -e "${GREEN}✓ Generated $OUTPUT_FILE${NC}"
echo ""
echo "Next steps:"
echo "1. Review $OUTPUT_FILE"
echo "2. Create GitHub release with tag v$VERSION"
echo "3. Upload all bundle files and $OUTPUT_FILE"
echo "4. Publish the release"
echo ""
echo "Bundle files to upload:"
if [ -n "$MACOS_AARCH64_SIG" ]; then
    echo "  - $BUNDLE_DIR/macos/Wingman_aarch64.app.tar.gz"
fi
if [ -n "$MACOS_X64_SIG" ]; then
    echo "  - $BUNDLE_DIR/macos/Wingman_x64.app.tar.gz"
fi
if [ -n "$WINDOWS_X64_SIG" ]; then
    echo "  - $BUNDLE_DIR/nsis/Wingman_x64-setup.nsis.zip"
fi
if [ -n "$LINUX_AMD64_SIG" ]; then
    echo "  - $BUNDLE_DIR/appimage/wingman_amd64.AppImage.tar.gz"
fi
