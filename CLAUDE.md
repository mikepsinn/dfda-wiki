# CLAUDE.md

Keep any edits to this file as concise and information-dense as possible. Only add information that is reasonable to include in every message to you.

## Project Overview

The dFDA Wiki documents the "War on Disease" strategy: redirecting 1% of global military spending to health research via the 1% Treaty, Decentralized Institutes of Health (DIH), and decentralized FDA (dFDA). 

## Common Commands

```bash
# Install dependencies
npm install

# 11ty Static Site (builds to _site/)
npm run dev              # Start dev server at localhost:8080
npm run build            # Full build (11ty + Pagefind search)
npm run build:11ty       # Build 11ty only
```

## Architecture

### Content Structure (Wiki Pages)
- `strategy/` - Treaty/DIH strategy, playbooks, roadmaps
- `features/` - dFDA platform specs, technical roadmaps, treasury architecture
- `economic-models/` - Fundraising, tokenomics, ROI models
- `regulatory/` - Legal analysis, compliance, model acts
- `operations/` - SOPs, security, processes
- `community/` - Partners, templates, outreach
- `reference/` - Citations, datasets, appendices
- `clinical-trials/` - Trial methodologies, protocols

### Scripts (`scripts/`)
TypeScript/JavaScript automation tools

### 11ty Static Site (`_site/`)
The wiki can be built as a static site using Eleventy (11ty):
- `.eleventy.js` - Main configuration with collections, filters, markdown processing
- `_layouts/` - Nunjucks templates (base.njk, page.njk, docs.njk, home.njk)
- `_includes/` - Partials (header.njk, footer.njk)
- `_data/` - Global data (site.json, eleventyComputed.js)
- `css/styles.css` - Tailwind CSS v4 styles
- Pagefind provides static search indexing
- GitHub Actions deploys to GitHub Pages on push to master

### Environment Variables
Required in `.env` 

## Content Conventions

### Frontmatter (Required)
Every markdown file must have YAML frontmatter:
```yaml
---
title: "Page Title"
description: "Brief summary under 140 characters"
published: true
date: '2025-01-20T00:00:00.000Z'
tags: tag1, tag2
editor: markdown
dateCreated: '2025-01-20T00:00:00.000Z'
---
```

**Important:** Quote title/description fields if they contain colons (`:`) to avoid YAML parsing errors.

### Linking
- Use page-relative paths: `[Link](./features/human-file-system-protocol.md)` or `[Link](./features/human-file-system-protocol.md)`
- Never use bare URLs or backticked paths for navigation
- Link to sections with anchors: `[Section](./file.md#heading-slug)`

### Citations
- All factual claims must be cited with hyperlinks
- In-body links point to internal anchors: `[claim](#anchor-id)`
- Add "Source Quotes" section at file end with external URLs and direct quotes

### Dollar Signs
Escape `\$` in body text to prevent LaTeX rendering (not needed in code blocks).

## Voice Guidelines

- Write at 6th grade reading level
- Be direct: "Make curing people more profitable than killing them"
- Quantify everything; pair moral arguments with data
- Avoid corporate speak: leverage, utilize, synergies, holistic, transformative, stakeholders
- Preserve edgy language like "bribe" - it's intentional
- Frame as co-opting ("we pay better") not fighting ("they are evil")

## Contributing Guidelines

### Maintaining CLAUDE.md
- Keep concise and information-dense - no fluff
- Use bullet points and code examples over paragraphs
- Update Common Commands when adding reusable scripts
- Remove outdated information immediately

### Scripts
- Use tsx instead of ts-node for all scripts
- **Add to package.json**: Reusable automation that will be run multiple times (validation, building, testing)
- **DO NOT add**: One-off fix scripts, migration scripts, or temporary utilities
- One-off scripts belong in `scripts/` without npm aliases - run directly with `npx tsx scripts/file.ts`
