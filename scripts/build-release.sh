#!/bin/bash
# Build a signed Wingman release

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Wingman Release Builder${NC}"
echo "======================"
echo ""

# Check for key file
KEY_FILE=~/.tauri/wingman-private-key.txt

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}Error: Private key not found!${NC}"
    echo ""
    echo "Run this first to set up the key:"
    echo -e "  ${YELLOW}./scripts/setup-signing-key.sh${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Found private key"

# Load key from file
export TAURI_SIGNING_PRIVATE_KEY=$(cat "$KEY_FILE")
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

# Get version
VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')

echo -e "${GREEN}✓${NC} Building version: ${YELLOW}$VERSION${NC}"
echo ""

# Build
echo "Building release... (this may take a few minutes)"
pnpm tauri build

echo ""
echo -e "${GREEN}✓ Build complete!${NC}"
echo ""
echo "Bundles created in:"
echo "  src-tauri/target/release/bundle/"
echo ""
echo "Next steps:"
echo "  1. Run: ${YELLOW}./scripts/generate-update-manifest.sh${NC}"
echo "  2. Create GitHub release with tag: ${YELLOW}v$VERSION${NC}"
echo "  3. Upload bundles and latest.json"
