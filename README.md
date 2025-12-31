# CACHE-FLOW Documentation

Documentation site for CACHE-FLOW - Zero-Thought Cache Management for TanStack Query.

## Quick Start

### Local Development

```bash
# Install dependencies
npm run install:docs

# Start Docusaurus dev server (docs at localhost:3000/docs/)
npm run dev:docs

# In another terminal, open landing page
open landing/index.html
```

### Build for Production

```bash
# Build everything
npm run build

# Preview the build
npm run preview
```

## Project Structure

```
cache-flow-docs/
├── landing/                 # Static landing page
│   ├── index.html          # Main landing page
│   ├── _headers            # Cloudflare headers config
│   └── _redirects          # Cloudflare redirects
├── docs/                    # Docusaurus site
│   ├── docs/               # Markdown documentation
│   ├── src/                # Custom components/CSS
│   └── docusaurus.config.js
├── scripts/
│   └── build.js            # Unified build script
├── dist/                    # Build output (generated)
│   ├── index.html          # Landing page
│   └── docs/               # Docusaurus build
└── package.json            # Root scripts
```

## Deployment to Cloudflare Pages

### 1. Connect Repository

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. Click "Create a project" → "Connect to Git"
3. Select this repository

### 2. Configure Build Settings

| Setting | Value |
|---------|-------|
| **Framework preset** | None |
| **Build command** | `npm run install:docs && npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` |
| **Node.js version** | `18` (set in Environment Variables) |

### 3. Environment Variables

Add these in Cloudflare Pages settings:

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `18` |

### 4. Custom Domain

1. Go to project settings → Custom domains
2. Add `cache-flow.dev`
3. Follow DNS configuration instructions

### URL Structure (Production)

| URL | Content |
|-----|---------|
| `cache-flow.dev/` | Landing page |
| `cache-flow.dev/docs/intro` | Documentation home |
| `cache-flow.dev/docs/getting-started/installation` | Getting started |
| `cache-flow.dev/docs/api-reference/createQueryGroupCRUD` | API reference |

## Development Notes

### Landing Page Links

The landing page uses placeholder `href` values that get transformed:
- **Local dev (file://)**: Links open `localhost:3000/docs/*` in new tabs
- **Production build**: Links are rewritten to `/docs/*`

### Docusaurus Configuration

Key settings in `docs/docusaurus.config.js`:
- `baseUrl: '/docs/'` - Docs served from /docs/ path
- `trailingSlash: false` - Clean URLs without trailing slashes

---

## Legacy: Documentation Generator

This directory also contains the Ralph Wiggum loop setup for generating documentation.

### Files

| File | Purpose |
|------|---------|
| `.ralph-wiggum-prompt.md` | Main loop instructions |
| `CLAUDE.md` | Project context and technical details |

### Generated Structure

After the loop completes, you should have:

```
cache-flow-docs/
├── landing/
│   ├── index.html              # Complete landing page
│   └── screenshots/            # Visual verification images
│       ├── desktop.png
│       └── mobile.png
├── docs/
│   ├── package.json            # Docusaurus dependencies
│   ├── docusaurus.config.js    # Site configuration
│   ├── sidebars.js             # Navigation structure
│   ├── static/img/             # Images and assets
│   ├── src/
│   │   ├── css/custom.css      # Custom styling
│   │   └── pages/
│   └── docs/
│       ├── intro.md
│       ├── getting-started/
│       │   ├── installation.md
│       │   ├── quick-start.md
│       │   └── project-structure.md
│       ├── core-concepts/
│       │   ├── query-keys.md
│       │   ├── query-groups.md
│       │   ├── crud-factory.md
│       │   └── key-injection.md
│       ├── api-reference/
│       │   ├── createQueryGroupCRUD.md
│       │   ├── invalidateQueriesForKeys.md
│       │   ├── cancelQueriesForKeys.md
│       │   └── inyectKeysToQueries.md
│       ├── patterns/
│       │   ├── wrapper-hooks.md
│       │   ├── cascade-invalidation.md
│       │   ├── optimistic-updates.md
│       │   ├── pagination.md
│       │   └── entity-mapping.md
│       └── advanced/
│           ├── kubb-integration.md
│           ├── axios-interceptors.md
│           └── migration-guide.md
├── CLAUDE.md
├── README.md
└── .ralph-wiggum-prompt.md
```

## Verifying Completion

The loop will output the following promise when complete:

```
<promise>CACHE-FLOW-DOCS-COMPLETE</promise>
```

### Manual Verification Steps

1. **Landing Page**
   ```bash
   open landing/index.html
   ```
   Should display a professional landing page with code examples.

2. **Documentation Site**
   ```bash
   cd docs
   npm install
   npm run start
   ```
   Visit http://localhost:3000 to browse documentation.

3. **Build Check**
   ```bash
   cd docs
   npm run build
   ```
   Should complete without errors.

## Loop Phases

| Phase | Iterations | Focus |
|-------|------------|-------|
| 1 | 1-15 | Landing page design and implementation |
| 2 | 16-25 | Docusaurus setup and configuration |
| 3 | 26-40 | Core documentation content |
| 4 | 41-45 | Naive reviewer validation |
| 5 | 46-50 | Final polish and verification |

## Skills Used During Loop

- **ui-ux-pro-max** - Landing page design, responsive layouts
- **seo-optimizer** - Meta tags, semantic HTML, schema markup
- **playwright-skill** - Screenshot verification of rendered pages

## Troubleshooting

### Loop Stalls
If the loop seems stuck, check if it's waiting for:
- User confirmation on file writes
- Network requests for Docusaurus setup

### Missing Source Files
Ensure the source code is available at:
```
~/Documents/projects/biyuya-workspace/biyuya-frontend/src/queries/index.ts
```

### Docusaurus Build Errors
Common fixes:
```bash
cd docs
rm -rf node_modules package-lock.json
npm install
```

## Contributing

To improve the documentation template:
1. Modify `.ralph-wiggum-prompt.md` for loop behavior
2. Modify `CLAUDE.md` for context changes
3. Re-run the loop

## Source Code

The actual CACHE-FLOW implementation this documents:
- **Repository**: `~/Documents/projects/biyuya-workspace/`
- **Core file**: `biyuya-frontend/src/queries/index.ts`
- **KUBB config**: `biyuya-frontend/kubb.config.ts`
