#!/usr/bin/env node

/**
 * Build script for CACHE-FLOW documentation site
 *
 * Combines:
 * - Landing page (landing/) → dist/
 * - Docusaurus build (docs/build/) → dist/docs/
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const LANDING = path.join(ROOT, 'landing');
const DOCS_BUILD = path.join(ROOT, 'docs', 'build');

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Remove directory recursively
 */
function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('Building CACHE-FLOW documentation site...\n');

// 1. Clean dist folder
console.log('1. Cleaning dist folder...');
rmDir(DIST);
fs.mkdirSync(DIST, { recursive: true });

// 2. Check that Docusaurus build exists
if (!fs.existsSync(DOCS_BUILD)) {
  console.error('Error: Docusaurus build not found at', DOCS_BUILD);
  console.error('Run "npm run build:docs" first.');
  process.exit(1);
}

// 3. Copy Docusaurus build to dist/docs/
console.log('2. Copying Docusaurus build to dist/docs/...');
copyDir(DOCS_BUILD, path.join(DIST, 'docs'));

// 4. Copy landing page to dist/
console.log('3. Copying landing page to dist/...');
for (const entry of fs.readdirSync(LANDING, { withFileTypes: true })) {
  const srcPath = path.join(LANDING, entry.name);
  const destPath = path.join(DIST, entry.name);

  if (entry.isDirectory()) {
    copyDir(srcPath, destPath);
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

// 5. Update landing page links for production (remove JS-based routing)
console.log('4. Updating landing page for production...');
const indexPath = path.join(DIST, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf-8');

// Replace placeholder hrefs with actual production paths
indexHtml = indexHtml.replace(/href="docs\/index\.html"/g, 'href="/docs/intro"');
indexHtml = indexHtml.replace(/href="docs\/getting-started\/installation\.html"/g, 'href="/docs/getting-started/installation"');

// Remove the local dev script (not needed in production)
indexHtml = indexHtml.replace(/<script>[\s\S]*?\/\/ Handle docs links[\s\S]*?<\/script>/m, '');

fs.writeFileSync(indexPath, indexHtml);

console.log('\nBuild complete! Output in dist/');
console.log('\nStructure:');
console.log('  dist/');
console.log('  ├── index.html        (landing page)');
console.log('  └── docs/             (Docusaurus site)');
console.log('      ├── intro/');
console.log('      ├── getting-started/');
console.log('      └── ...');
console.log('\nTo preview: npm run preview');
