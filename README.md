# Sedifex Developer Portal

Sedifex Developer Portal is a Next.js (App Router) site that publishes developer-facing integration docs, tutorials, and starter-kit information from the repository's local `docs/` content files.

## What this project is

- **Product surface:** Public-facing documentation experience for Sedifex developers.
- **Primary sections:** Home, Documentation, Tutorials, Starters, Partners, and Earn pages.
- **Content source of truth:** Markdown/MDX/PHP files under `docs/` are parsed and rendered into the docs UI.

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Markdown pipeline: `gray-matter`, `react-markdown`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`

## Project structure

```text
app/                   # Canonical Next.js App Router tree
  docs/                # Docs index + dynamic doc routes
  tutorials/           # Curated tutorial pages pulled from docs/
  starters/            # Starter kit catalog page
  partners/            # Partner information page
  earn/                # Monetization/earn page
src/
  components/          # Reusable UI for docs rendering/navigation
  lib/docs.ts          # Local docs discovery + parsing utilities
docs/                  # Source content rendered by the portal
public/                # Static assets
scripts/generate-sitemap.mjs
```

## Local development

### Prerequisites

- Node.js 20+
- npm 10+

### Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Content authoring workflow

All documentation content lives in `docs/`.

### Add a new document

1. Create a `.md`, `.mdx`, or `.php` file in `docs/` (nested folders supported).
2. Recommended frontmatter:

```md
---
title: Your page title
description: One-line summary for cards and metadata.
---
```

3. Save and refresh. The portal auto-discovers the file and exposes it under `/docs/<slug>`.

### Slug behavior

- `docs/integration-api-guide.md` → `/docs/integration-api-guide`
- `docs/guides/payments/stripe.md` → `/docs/guides/payments/stripe`
- `.php` files are rendered as code blocks for reference.

### Tutorials curation

`/tutorials` currently embeds selected docs by slug. Update `embeddedDocs` in `app/tutorials/page.tsx` to change which docs appear there.

## Build, lint, and production run

```bash
npm run lint
npm run build
npm run start
```

## Deployment notes

- This app is compatible with standard Next.js deployments (for example Vercel or containerized Node hosting).
- Ensure the `docs/` directory is included in deployment artifacts, since docs are read from the local filesystem at runtime/build time.

## Docs maintenance checklist

- Keep document titles/descriptions present and concise.
- Prefer one topic per file to keep navigation predictable.
- When adding new integration guides, verify they appear in `/docs` and deep links resolve correctly.
