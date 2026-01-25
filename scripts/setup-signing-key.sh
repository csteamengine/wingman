#!/bin/bash
# Setup Tauri signing key for building releases

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Wingman Signing Key Setup${NC}"
echo "========================="
echo ""
echo "This script will save your Tauri private signing key to:"
echo "  ~/.tauri/wingman-private-key.txt"
echo ""
echo -e "${YELLOW}Please paste your private key (the long base64 string):${NC}"
read -r PRIVATE_KEY

# Validate it's not empty
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: No key provided${NC}"
    exit 1
fi

# Create .tauri directory in home
mkdir -p ~/.tauri

# Save key to file
KEY_FILE=~/.tauri/wingman-private-key.txt
echo "$PRIVATE_KEY" > "$KEY_FILE"
chmod 600 "$KEY_FILE"

echo -e "${GREEN}✓${NC} Saved private key to: ${YELLOW}$KEY_FILE${NC}"
echo ""
echo "To build a signed release, run:"
echo ""
echo -e "  ${YELLOW}export TAURI_SIGNING_PRIVATE_KEY=\$(cat $KEY_FILE)${NC}"
echo -e "  ${YELLOW}export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=\"\"${NC}"
echo -e "  ${YELLOW}pnpm tauri build${NC}"
echo ""
echo "Or use the build-release.sh script (recommended)"
