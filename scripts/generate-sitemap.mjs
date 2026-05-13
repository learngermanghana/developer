import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SITEMAP_PATH = 'sitemap.xml';
const SITE_ORIGIN = 'https://developer.sedifex.com';

function getGitLastModifiedDate(filePath) {
  try {
    return execSync(`git log -1 --format=%cs -- ${JSON.stringify(filePath)}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function resolveFilePathFromLoc(loc) {
  const url = new URL(loc);
  const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  return path.normalize(relativePath);
}

const input = readFileSync(SITEMAP_PATH, 'utf8');
const updated = input.replace(/<url>([\s\S]*?)<\/url>/g, (block) => {
  const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
  if (!locMatch) return block;

  const loc = locMatch[1].trim();
  if (!loc.startsWith(SITE_ORIGIN)) return block;

  const targetFile = resolveFilePathFromLoc(loc);
  const lastmod = getGitLastModifiedDate(targetFile);
  if (!lastmod) return block;

  if (/<lastmod>[^<]*<\/lastmod>/.test(block)) {
    return block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${lastmod}</lastmod>`);
  }

  return block.replace(/<loc>[^<]+<\/loc>/, `$&\n    <lastmod>${lastmod}</lastmod>`);
});

writeFileSync(SITEMAP_PATH, updated);
console.log('Updated sitemap.xml lastmod values from git history.');
