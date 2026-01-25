#!/bin/bash
# Interactive release script for Wingman
#
# This script triggers a GitHub Actions workflow that:
# 1. Builds for all platforms
# 2. Only if ALL builds succeed:
#    - Commits the version bump
#    - Creates the git tag
#    - Creates the GitHub release

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

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is required but not installed.${NC}"
    echo "Install it with: brew install gh"
    exit 1
fi

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

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠ You're on branch '$CURRENT_BRANCH', not 'main'.${NC}"
    echo -e "Continue anyway? (y/N)"
    read -r BRANCH_CONFIRM
    if [[ ! "$BRANCH_CONFIRM" =~ ^[Yy]$ ]]; then
        exit 0
    fi
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
echo -e "${BLUE}📝 This will trigger a GitHub Actions workflow that:${NC}"
echo "  1. Builds for macOS (ARM64 + Intel)"
echo "  2. Builds for Windows (x64)"
echo "  3. Builds for Linux (x64)"
echo "  4. Signs all binaries"
echo ""
echo -e "${GREEN}  ✓ Only if ALL builds succeed:${NC}"
echo "    • Commits version bump to main"
echo "    • Creates git tag v$NEW_VERSION"
echo "    • Creates GitHub release with all artifacts"
echo ""
echo -e "${YELLOW}⚠ No local changes will be made until builds succeed!${NC}"
echo ""
echo -e "${YELLOW}Continue? (y/N)${NC}"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Push any local commits first
echo ""
echo -e "${BLUE}📤 Pushing any local commits...${NC}"
git push 2>/dev/null || true

# Trigger the workflow
echo ""
echo -e "${BLUE}🚀 Triggering release workflow for v$NEW_VERSION...${NC}"
gh workflow run release.yml -f version="$NEW_VERSION"

echo ""
echo -e "${GREEN}✅ Release workflow triggered!${NC}"
echo ""
echo "GitHub Actions will now:"
echo "  • Build for macOS (ARM64 + Intel)"
echo "  • Build for Windows (x64)"
echo "  • Build for Linux (x64)"
echo "  • Sign all binaries"
echo "  • Create GitHub release (only if all builds succeed)"
echo ""
echo -e "Monitor progress: ${BLUE}https://github.com/csteamengine/wingman/actions${NC}"
echo ""
echo -e "${YELLOW}Note: Version bump and tag will only be created if all builds succeed!${NC}"
echo ""
echo -e "After the workflow completes successfully, run:"
echo -e "  ${YELLOW}git pull${NC}  (to get the version bump commit)"
