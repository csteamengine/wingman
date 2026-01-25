#!/bin/bash
# Create a CHANGELOG entry for the current version

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Changelog Entry Generator${NC}"
echo "========================="
echo ""

# Get current version
VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
DATE=$(date +"%Y-%m-%d")

echo -e "Version: ${YELLOW}v$VERSION${NC}"
echo -e "Date: ${YELLOW}$DATE${NC}"
echo ""

# Create CHANGELOG.md if it doesn't exist
if [ ! -f "CHANGELOG.md" ]; then
    cat > CHANGELOG.md <<EOF
# Changelog

All notable changes to Wingman will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF
fi

# Prepare new entry
echo "Enter changelog entries (press Ctrl+D when done):"
echo ""
echo "Categories: Added, Changed, Fixed, Removed, Security"
echo ""

ENTRIES=$(cat)

# Create entry
NEW_ENTRY="
## [${VERSION}] - ${DATE}

${ENTRIES}
"

# Insert after the header
awk -v entry="$NEW_ENTRY" '
  NR==1,/^$/ {print; if (/^$/) {print entry; skip=1}}
  skip && /^$/ {skip=0; next}
  !skip {print}
' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md

echo ""
echo -e "${GREEN}✓ Changelog entry added${NC}"
echo ""
echo "Review CHANGELOG.md and commit when ready"
