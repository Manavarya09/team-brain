# Team Brain

**Git-native shared AI memory for teams.**

Your teammate debugged that issue yesterday. Your team decided on REST over GraphQL last month. Your codebase has conventions that every AI session ignores.

Team Brain fixes this. Record lessons, decisions, and conventions once — they're automatically loaded into every Claude Code session, for every team member. No servers. No accounts. Just git.

---

## The Problem

AI coding agents are single-player:

- Your teammate spent 2 hours debugging a Stripe webhook — Claude doesn't know
- The team agreed to use async/await everywhere — Claude uses `.then()` anyway
- You onboarded a new dev — their Claude starts from absolute zero
- Architecture decisions live in Slack threads nobody can find

CLAUDE.md exists, but it's manually maintained and nobody updates it.

## The Solution

Team Brain stores team knowledge in `.team-brain/` and auto-generates a `BRAIN.md` that Claude reads every session. Commit it to git. Everyone on the team gets the same context.

```
.team-brain/
├── BRAIN.md                      # Auto-generated, Claude reads this
├── conventions/
│   └── always-use-async-await.md
├── decisions/
│   └── 001-rest-over-graphql.md
├── lessons/
│   └── 2026-03-30-stripe-webhook-retry.md
└── knowledge/
    └── api-rate-limits.md
```

---

## Features

### Record Lessons
```
/team-brain learn Stripe webhooks retry 3 times with exponential backoff
```
Claude captures the context from your current conversation, creates a structured entry, and regenerates BRAIN.md.

### Record Decisions (ADR Format)
```
/team-brain decide Use REST over GraphQL for public API
```
Creates an Architecture Decision Record with Context, Decision, and Consequences sections.

### Add Conventions
```
/team-brain convention Always use async/await, never .then() chains
```
Conventions get highest priority in BRAIN.md — Claude sees them first.

### Search the Brain
```
/team-brain recall stripe webhooks
```
Keyword + fuzzy search across all entries. Returns the most relevant matches with context snippets.

### Onboard New Developers
```
/team-brain onboard
```
Generates a comprehensive onboarding guide from all team brain entries — conventions, decisions, lessons, and project knowledge in one document.

### Cross-Tool Generation
```
/team-brain sync              # Regenerate BRAIN.md
/team-brain sync cursorrules  # Also generate .cursorrules (for Cursor)
/team-brain sync agents       # Also generate AGENTS.md (universal standard)
```

### Auto-Loading
Team Brain includes a SessionStart hook that automatically loads context at the beginning of every Claude Code session. If any entries are newer than BRAIN.md, it regenerates automatically.

---

## Installation

### Quick Install
```bash
git clone https://github.com/Manavarya09/team-brain.git ~/.claude/plugins/team-brain
```

### Add the SessionStart hook to your settings
Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "bash ~/.claude/plugins/team-brain/hooks/load-brain.sh"
        }]
      }
    ]
  }
}
```

### Initialize in your project
```
/team-brain init
```
This creates `.team-brain/` in your repo root. Commit it to git.

---

## Usage

### Quick Start
```bash
# Initialize team brain in your project
/team-brain init

# Add your first convention
/team-brain convention Use TypeScript strict mode everywhere

# Record a lesson from today's debugging
/team-brain learn React useEffect cleanup runs on unmount AND re-render

# Record an architecture decision
/team-brain decide Use Zod for runtime validation at API boundaries

# Commit and push so teammates get the context
git add .team-brain/ && git commit -m "team-brain: add initial conventions and decisions"
git push
```

### For Teammates
```bash
# Pull latest team brain entries
git pull

# Context loads automatically on next Claude Code session
# Or manually sync:
/team-brain sync
```

### Search and Recall
```bash
/team-brain recall validation     # Search for entries about validation
/team-brain recall                # Show recent entries
/team-brain status                # Show stats and contributor info
```

---

## Entry Format

Every entry is a markdown file with YAML frontmatter:

```yaml
---
title: Stripe webhooks retry 3 times with exponential backoff
type: lesson
author: manavarya
date: 2026-03-30
tags: [stripe, webhooks, payments]
status: active
---

## Context
Spent 2 hours debugging why payment confirmations were duplicated.

## Detail
Stripe retries failed webhook deliveries 3 times over 24 hours.
Our handler wasn't idempotent, causing duplicate order processing.
Fixed by checking idempotency key before processing.

## Related
- PR #47: Add idempotency check to webhook handler
```

### Entry Types
| Type | Directory | Priority | Format |
|------|-----------|----------|--------|
| Convention | `conventions/` | Highest | Rule + Examples + Rationale |
| Decision | `decisions/` | High | ADR: Context + Decision + Consequences |
| Lesson | `lessons/` | Medium | Context + Detail + Related |
| Knowledge | `knowledge/` | Normal | Free-form project knowledge |

---

## How It Works

1. **You record knowledge** via `/team-brain learn`, `/team-brain decide`, or `/team-brain convention`
2. **Entries are saved** as markdown files in `.team-brain/`
3. **BRAIN.md is auto-generated** — a prioritized summary under 180 lines
4. **On session start**, the hook loads BRAIN.md into Claude's context
5. **Teammates pull** via git and get the same context
6. **Optionally generates** `.cursorrules` (Cursor) and `AGENTS.md` (universal)

### Why 180 Lines?

Claude Code applies instructions from context files with ~92% accuracy under 200 lines. Above 400 lines, accuracy drops to ~71%. Team Brain auto-prioritizes (conventions > decisions > lessons > knowledge) and caps BRAIN.md at 180 lines to stay in the sweet spot.

---

## Configuration

Settings are in `.team-brain/config.json`:

```json
{
  "brain_max_lines": 180,
  "auto_generate": true,
  "inject_into_claude_md": true,
  "generate_cursorrules": false,
  "generate_agents_md": false,
  "priority_order": ["conventions", "decisions", "lessons", "knowledge"],
  "max_entries_per_section": 20,
  "include_dates": true,
  "include_authors": true
}
```

| Setting | Description | Default |
|---------|-------------|---------|
| `brain_max_lines` | Max lines in BRAIN.md | 180 |
| `inject_into_claude_md` | Auto-inject into CLAUDE.md | true |
| `generate_cursorrules` | Also generate .cursorrules | false |
| `generate_agents_md` | Also generate AGENTS.md | false |
| `priority_order` | Section priority in BRAIN.md | conventions first |
| `max_entries_per_section` | Max entries per section | 20 |

---

## Requirements

- Claude Code (any version with skill/hook support)
- Node.js (ships with Claude Code)
- Git (for sharing with teammates)

---

## FAQ

**Q: How is this different from just editing CLAUDE.md?**
A: CLAUDE.md is static and manually maintained. Team Brain auto-generates it from structured entries, stays under the 180-line sweet spot, and makes it easy for any team member to contribute knowledge without editing a shared file.

**Q: What happens when two people add entries on the same branch?**
A: Each entry is its own file, so git merges cleanly. BRAIN.md is auto-generated, so even if it conflicts, running `/team-brain sync` regenerates it.

**Q: Does this work with Cursor / Copilot?**
A: Yes. Run `/team-brain sync cursorrules` to generate `.cursorrules` for Cursor. Run `/team-brain sync agents` to generate `AGENTS.md` which Copilot and other tools read.

**Q: Will this slow down my sessions?**
A: The SessionStart hook runs in under 100ms. It only regenerates BRAIN.md if entries have changed.

**Q: Where is the data stored?**
A: Everything is in `.team-brain/` in your repo root. It's just files in git — no databases, no cloud, no external services.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where help is needed:
- [ ] Auto-learn hook: detect patterns worth remembering from tool output
- [ ] Conflict resolution UI for BRAIN.md merge conflicts
- [ ] Team analytics dashboard (who's contributing, coverage gaps)
- [ ] Integration with Linear/Jira for linking entries to tickets
- [ ] VS Code extension for browsing team brain entries

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Your AI should know what your team knows.**
