#!/bin/bash
# Bump version across all files (for local development only)
#
# NOTE: For releases, use ./scripts/release.sh or ./scripts/release-interactive.sh
# Those scripts trigger the GitHub workflow which handles version bumping
# after all builds succeed.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Wingman Version Bumper${NC}"
echo "======================"
echo ""

# Get current version
CURRENT_VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"
echo ""

# Ask for new version
echo -e "${YELLOW}Enter new version (e.g., 0.2.0):${NC}"
read -r NEW_VERSION

# Validate semver format
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Version must be in format X.Y.Z${NC}"
    exit 1
fi

echo ""
echo -e "Bumping version from ${YELLOW}$CURRENT_VERSION${NC} to ${YELLOW}$NEW_VERSION${NC}"
echo ""

# Update package.json
echo "Updating package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update tauri.conf.json
echo "Updating tauri.conf.json..."
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
conf.version = '$NEW_VERSION';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

# Update Cargo.toml
echo "Updating Cargo.toml..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
else
    sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
fi

echo ""
echo -e "${GREEN}✓ Version bumped to $NEW_VERSION${NC}"
echo ""
echo "Next steps:"
echo -e "  1. Review changes: ${YELLOW}git diff${NC}"
echo -e "  2. Update CHANGELOG.md with release notes"
echo -e "  3. Commit: ${YELLOW}git commit -am 'chore: Bump version to v$NEW_VERSION'${NC}"
echo -e "  4. Tag: ${YELLOW}git tag v$NEW_VERSION${NC}"
echo -e "  5. Push: ${YELLOW}git push && git push --tags${NC}"
echo ""
