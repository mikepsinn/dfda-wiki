/**
 * Add .md extension to internal links that are missing it
 *
 * Fixes links like ./architecture to ./architecture.md
 * Only fixes links that point to actual .md files
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('🔗 Add .md Extension to Internal Links');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  const files = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md', 'broken-urls-report.md'],
  });

  // Build index of existing .md files
  const existingFiles = new Set<string>();
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    existingFiles.add(normalized.toLowerCase());
    // Also add without .md for matching
    existingFiles.add(normalized.replace(/\.md$/, '').toLowerCase());
  }

  let totalFixes = 0;
  let filesFixed = 0;

  for (const file of files) {
    const fullPath = path.join(workspaceRoot, file);
    let content = fs.readFileSync(fullPath, 'utf-8');
    let modified = false;
    const fixes: string[] = [];

    // Match internal links that don't have .md extension
    // Pattern: [text](./path) or [text](../path) where path doesn't end in .md, /, or have extension
    const linkRegex = /\[([^\]]*)\]\((\.\.?\/[^)#]+)\)/g;

    const newContent = content.replace(linkRegex, (match, text, url) => {
      // Skip if already has .md extension
      if (url.endsWith('.md')) return match;

      // Skip if it's a directory link (ends with /)
      if (url.endsWith('/')) return match;

      // Skip if it has another extension (like .html, .png, etc.)
      if (/\.[a-zA-Z0-9]+$/.test(url)) return match;

      // Skip if it's an external URL (shouldn't match our pattern, but just in case)
      if (url.startsWith('http://') || url.startsWith('https://')) return match;

      // Check if the target file exists with .md extension
      const sourceDir = path.dirname(file);
      const targetPath = path.join(sourceDir, url + '.md').replace(/\\/g, '/');
      const normalizedTarget = path.normalize(targetPath).replace(/\\/g, '/').toLowerCase();

      // Check if target file exists
      const fullTargetPath = path.join(workspaceRoot, targetPath);
      if (fs.existsSync(fullTargetPath)) {
        fixes.push(`  ${url} → ${url}.md`);
        return `[${text}](${url}.md)`;
      }

      return match;
    });

    if (newContent !== content) {
      modified = true;
      filesFixed++;
      totalFixes += fixes.length;

      console.log(`\n📄 ${file}:`);
      fixes.forEach(f => console.log(f));

      if (!dryRun) {
        fs.writeFileSync(fullPath, newContent, 'utf-8');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files fixed: ${filesFixed}`);
  console.log(`Total fixes: ${totalFixes}`);

  if (dryRun) {
    console.log('\nThis was a dry run. Run without --dry-run to apply fixes.');
  } else {
    console.log('\n✅ Fixes applied! Run npm run validate-links to verify.');
  }
}

main().catch(console.error);
