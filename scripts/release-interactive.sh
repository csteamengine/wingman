#!/bin/bash
# Interactive release script with changelog support

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════╗${NC}"
echo -e "${GREEN}║   Wingman Release Helper    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════╝${NC}"
echo ""

# Get current version
CURRENT_VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
echo -e "📦 Current version: ${YELLOW}v$CURRENT_VERSION${NC}"
echo ""

# Check if git is clean
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}⚠ You have uncommitted changes!${NC}"
    echo "Please commit or stash them first."
    exit 1
fi

# Ask for new version
echo -e "${BLUE}❓ Enter new version (e.g., 0.2.0):${NC}"
read -r NEW_VERSION

# Validate semver
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ Invalid version format. Use X.Y.Z${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📝 This will:${NC}"
echo "  1. Bump version to v$NEW_VERSION"
echo "  2. Let you add CHANGELOG entries"
echo "  3. Commit changes"
echo "  4. Create git tag v$NEW_VERSION"
echo "  5. Push to GitHub (triggers release workflow)"
echo ""
echo -e "${YELLOW}Continue? (y/N)${NC}"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Bump version
echo ""
echo -e "${BLUE}🔧 Bumping version...${NC}"

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update tauri.conf.json
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
conf.version = '$NEW_VERSION';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

# Update Cargo.toml
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
else
    sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
fi

echo -e "${GREEN}✓ Version bumped to v$NEW_VERSION${NC}"

# Update changelog
echo ""
echo -e "${BLUE}📄 Add to CHANGELOG.md? (Y/n)${NC}"
read -r ADD_CHANGELOG

if [[ ! "$ADD_CHANGELOG" =~ ^[Nn]$ ]]; then
    # Create CHANGELOG.md if it doesn't exist
    if [ ! -f "CHANGELOG.md" ]; then
        cat > CHANGELOG.md <<EOF
# Changelog

All notable changes to Wingman will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF
    fi

    echo ""
    echo "Enter changelog entries (press Ctrl+D when done):"
    echo "Categories: Added, Changed, Fixed, Removed, Security"
    echo ""

    ENTRIES=$(cat)
    DATE=$(date +"%Y-%m-%d")

    # Create entry
    NEW_ENTRY="
## [$NEW_VERSION] - $DATE

$ENTRIES
"

    # Insert after the header
    awk -v entry="$NEW_ENTRY" '
      NR==1,/^$/ {print; if (/^$/) {print entry; skip=1}}
      skip && /^$/ {skip=0; next}
      !skip {print}
    ' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md

    echo -e "${GREEN}✓ CHANGELOG.md updated${NC}"
    git add CHANGELOG.md
fi

# Commit
echo ""
echo -e "${BLUE}💾 Committing changes...${NC}"
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: Release v$NEW_VERSION"
echo -e "${GREEN}✓ Changes committed${NC}"

# Tag
echo -e "${BLUE}🏷  Creating tag v$NEW_VERSION...${NC}"
git tag "v$NEW_VERSION"
echo -e "${GREEN}✓ Tag created${NC}"

# Push
echo ""
echo -e "${YELLOW}📤 Push to GitHub? This will trigger the release workflow. (y/N)${NC}"
read -r PUSH_CONFIRM

if [[ "$PUSH_CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
    git push
    git push --tags

    echo ""
    echo -e "${GREEN}✅ Release initiated!${NC}"
    echo ""
    echo "GitHub Actions will now:"
    echo "  • Build for macOS (ARM64 + Intel)"
    echo "  • Build for Windows (x64)"
    echo "  • Build for Linux (x64)"
    echo "  • Sign all binaries"
    echo "  • Create GitHub release"
    echo "  • Generate latest.json for auto-updates"
    echo ""
    echo -e "Monitor progress: ${BLUE}https://github.com/csteamengine/wingman/actions${NC}"
else
    echo ""
    echo -e "${YELLOW}ℹ Changes committed and tagged locally.${NC}"
    echo "Push when ready with:"
    echo -e "  ${YELLOW}git push && git push --tags${NC}"
fi
