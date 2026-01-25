#!/bin/bash
# Release script for Wingman
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.3.0
#
# This script triggers a GitHub Actions workflow that:
# 1. Builds for all platforms
# 2. Only if ALL builds succeed:
#    - Commits the version bump
#    - Creates the git tag
#    - Creates the GitHub release

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.3.0"
  exit 1
fi

# Remove 'v' prefix if provided
VERSION="${VERSION#v}"

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in format X.Y.Z"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')

echo "Releasing version $VERSION (current: $CURRENT_VERSION)..."
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is required but not installed."
  echo "Install it with: brew install gh"
  exit 1
fi

# Ensure we're on main branch and up to date
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Warning: You're on branch '$CURRENT_BRANCH', not 'main'."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Push any local commits first
echo "Pushing any local commits..."
git push

# Trigger the workflow
echo ""
echo "Triggering release workflow for v$VERSION..."
gh workflow run release.yml -f version="$VERSION"

echo ""
echo "✅ Release workflow triggered!"
echo ""
echo "The workflow will:"
echo "  • Build for macOS (ARM64 + Intel)"
echo "  • Build for Windows (x64)"
echo "  • Build for Linux (x64)"
echo "  • Sign all binaries"
echo "  • If ALL builds succeed:"
echo "    - Commit version bump to main"
echo "    - Create git tag v$VERSION"
echo "    - Create GitHub release"
echo ""
echo "Monitor progress at: https://github.com/csteamengine/wingman/actions"
echo ""
echo "Note: Version bump and tag will only be created if all builds succeed!"
