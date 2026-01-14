# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The dFDA Wiki documents the "War on Disease" strategy: redirecting 1% of global military spending to health research via the 1% Treaty, Decentralized Institutes of Health (DIH), and decentralized FDA (dFDA). This is both an Obsidian vault and a publishable wiki with automation scripts.

## Common Commands

```bash
# Install dependencies
npm install

# 11ty Static Site (builds to _site/)
npm run dev              # Start dev server at localhost:8080
npm run build            # Full build (11ty + Pagefind search)
npm run build:11ty       # Build 11ty only
npm run build:search     # Build Pagefind search index

# Run tests
npm test

# Run a single test file
npx jest scripts/tests/article-evaluator.test.ts

# Lint markdown files
npm run lint:md

# Find duplicate filenames
npm run find-duplicates

# Find orphaned pages (no links to them)
npm run find-orphaned-pages

# Validate internal links (source markdown files)
npm run validate-links

# Validate built site links (checks _site/ folder for broken links)
# This script is Vercel-aware and handles .md redirects
npm run validate:built

# Build and validate in one step
npm run build:validate

# Fix .md links in source files (converts file.md → file/)
npm run fix-md-links              # Apply fixes
npm run fix-md-links:dry-run      # Preview changes without modifying files

# Generate directory tree
npm run tree                    # Console output
npm run tree:md                 # Markdown format
npm run tree:metadata           # With frontmatter metadata

# Sync with Google Docs
npm run gdocs-sync

# Fix frontmatter metadata
npm run fix-frontmatter

# Run TypeScript files directly
npm run ts-node scripts/your-script.ts
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
TypeScript/JavaScript automation tools:
- `validate-links.ts` - Check for broken internal links
- `find-duplicate-filenames.ts` - Detect duplicate file names
- `find-orphaned-pages.ts` - Find pages with no inbound links
- `fix_frontmatter_metadata.ts` - Normalize YAML frontmatter
- `gdocs-sync.ts` - Sync content with Google Docs
- `llm-client.ts` - Multi-provider LLM client (OpenAI, Anthropic, Google, DeepSeek, Perplexity)
- `generate-tree-with-metadata.ts` - Generate directory tree with frontmatter info

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
Required in `.env` for scripts that use LLM APIs:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `PERPLEXITY_API_KEY`

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

For canonical tracking, also include:
```yaml
topic_id: stable-identifier
canonical: true
status: draft | active | deprecated | archived
domains: [treaty | dih | dfda | cross]
doc_type: strategy | spec | regulatory | model | ops | reference
```

### Linking
- Use page-relative paths: `[Link](./file.md)` or `[Link](../folder/file.md)`
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
