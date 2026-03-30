#!/bin/bash
# SessionStart hook: Load team brain context into the session
# Finds .team-brain/ in the project, regenerates BRAIN.md if stale, outputs to stderr

SCRIPT_DIR="$(cd "$(dirname "$0")/../scripts" && pwd)"

# Read stdin (hook input) but we don't need it
cat > /dev/null

# Find project root with .team-brain/
ROOT=$(node -e "
  const store = require('$SCRIPT_DIR/store');
  const root = store.findProjectRoot();
  const fs = require('fs');
  const path = require('path');
  const brainDir = path.join(root, '.team-brain');
  if (fs.existsSync(brainDir)) {
    console.log(root);
  }
" 2>/dev/null)

# If no .team-brain/ found, exit silently
if [ -z "$ROOT" ]; then
  exit 0
fi

BRAIN_DIR="$ROOT/.team-brain"
BRAIN_MD="$BRAIN_DIR/BRAIN.md"

# Check if BRAIN.md needs regeneration (any entry newer than BRAIN.md)
NEEDS_REGEN=false
if [ ! -f "$BRAIN_MD" ]; then
  NEEDS_REGEN=true
else
  for dir in lessons decisions conventions knowledge; do
    if [ -d "$BRAIN_DIR/$dir" ]; then
      NEWER=$(find "$BRAIN_DIR/$dir" -name "*.md" -newer "$BRAIN_MD" 2>/dev/null | head -1)
      if [ -n "$NEWER" ]; then
        NEEDS_REGEN=true
        break
      fi
    fi
  done
fi

# Regenerate if needed
if [ "$NEEDS_REGEN" = true ]; then
  node "$SCRIPT_DIR/generator.js" generate "$ROOT" > /dev/null 2>&1
fi

# Output brain summary to stderr so Claude sees it
if [ -f "$BRAIN_MD" ]; then
  LINES=$(wc -l < "$BRAIN_MD" | tr -d ' ')
  ENTRIES=$(node -e "
    const store = require('$SCRIPT_DIR/store');
    console.log(store.listEntries('$ROOT').length);
  " 2>/dev/null)
  echo "Team Brain loaded: $ENTRIES entries, $LINES lines" >&2
fi

exit 0
