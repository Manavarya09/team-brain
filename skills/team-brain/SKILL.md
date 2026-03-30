---
name: team-brain
description: "Shared team memory for Claude Code. Record lessons, decisions, and conventions that persist across sessions and team members. Use when user says 'team brain', 'learn', 'decide', 'convention', 'recall', 'team memory', or '/team-brain'. Subcommands: learn, decide, convention, recall, status, init."
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Team Brain

You are the Team Brain assistant. Help teams record and recall shared knowledge.

First, find the project root (look for `.team-brain/` or `.git/` directory):
```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" find-root
```

## Commands

Parse the user's input and execute the appropriate command:

### `/team-brain` or `/team-brain status` (default)
Show team brain statistics:
```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/stats.js"
```
Display the ASCII output as-is.

### `/team-brain init`
Initialize team brain in the current project:
```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/store.js" init
```
Tell the user to commit `.team-brain/` to git so teammates can access it.

### `/team-brain learn <insight>`
Record a lesson learned. Steps:
1. Extract the key insight from the user's message and current conversation context
2. Generate a descriptive title (2-8 words)
3. Write the lesson body with Context, Detail, and Related sections
4. Auto-detect the author from git config
5. Suggest relevant tags based on files being discussed
6. Create the entry:
```bash
node -e "
  const store = require('${CLAUDE_SKILL_DIR}/../../scripts/store');
  const gen = require('${CLAUDE_SKILL_DIR}/../../scripts/generator');
  const root = store.findProjectRoot();
  const body = \`## Context\n\nDISCOVERED_CONTEXT\n\n## Detail\n\nINSIGHT_DETAIL\n\n## Related\n\nRELATED_LINKS\`;
  const result = store.addEntry(root, 'lessons', 'TITLE', body, null, ['TAG1', 'TAG2']);
  gen.generateBrain(root);
  console.log('Lesson recorded: ' + result.filename);
  console.log('BRAIN.md regenerated.');
"
```
Replace TITLE, DISCOVERED_CONTEXT, INSIGHT_DETAIL, RELATED_LINKS, TAG1, TAG2 with actual values extracted from the conversation.

### `/team-brain decide <title>`
Record an architecture decision (ADR format). Steps:
1. Use the title from the user's message
2. Gather context from the conversation about WHY this decision was made
3. Ask the user what the actual decision is if not clear
4. List consequences (pros and cons)
5. Create the entry:
```bash
node -e "
  const store = require('${CLAUDE_SKILL_DIR}/../../scripts/store');
  const gen = require('${CLAUDE_SKILL_DIR}/../../scripts/generator');
  const root = store.findProjectRoot();
  const body = \`## Context\n\nDECISION_CONTEXT\n\n## Decision\n\nDECISION_DETAIL\n\n## Consequences\n\n- Pro: PRO1\n- Pro: PRO2\n- Con: CON1\`;
  const result = store.addEntry(root, 'decisions', 'TITLE', body, null, ['TAG1']);
  gen.generateBrain(root);
  console.log('Decision recorded: ' + result.filename);
"
```

### `/team-brain convention <rule>`
Add a coding convention. Steps:
1. State the rule clearly from the user's message
2. Provide good and bad examples if possible
3. Explain the rationale
4. Create the entry:
```bash
node -e "
  const store = require('${CLAUDE_SKILL_DIR}/../../scripts/store');
  const gen = require('${CLAUDE_SKILL_DIR}/../../scripts/generator');
  const root = store.findProjectRoot();
  const body = \`## Rule\n\nRULE_TEXT\n\n## Examples\n\nGood:\n\\\`\\\`\\\`\nGOOD_EXAMPLE\n\\\`\\\`\\\`\n\nBad:\n\\\`\\\`\\\`\nBAD_EXAMPLE\n\\\`\\\`\\\`\n\n## Rationale\n\nRATIONALE\`;
  const result = store.addEntry(root, 'conventions', 'TITLE', body, null, ['TAG1']);
  gen.generateBrain(root);
  console.log('Convention recorded: ' + result.filename);
"
```

### `/team-brain recall [query]`
Search the team brain for relevant knowledge:
```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/search.js" search "" "QUERY"
```
Replace QUERY with the user's search terms. Display results clearly with titles, types, and snippets. If no query provided, show recent entries:
```bash
node "${CLAUDE_SKILL_DIR}/../../scripts/search.js" recent "" 5
```

## Response Guidelines
- Always regenerate BRAIN.md after adding entries
- Remind users to `git add .team-brain/ && git commit` after changes
- Keep entry titles concise but descriptive
- Extract maximum context from the current conversation
- Suggest tags based on the files and topics being discussed
