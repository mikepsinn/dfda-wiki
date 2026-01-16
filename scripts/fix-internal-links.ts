/**
 * Fix Internal Links Script
 *
 * Finds broken internal links and searches for the correct file paths.
 * Handles:
 * - Case-insensitive file matching
 * - Missing .md extensions
 * - Files that moved to different directories
 * - Broken relative path calculations
 *
 * Usage:
 *   npm run fix-internal-links              # Apply fixes
 *   npm run fix-internal-links -- --dry-run # Preview changes
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');

interface FileMatch {
  originalLink: string;
  foundFile: string;
  relativePath: string;
}

interface FixResult {
  file: string;
  fixes: Array<{
    line: number;
    original: string;
    replacement: string;
    reason: string;
  }>;
}

/**
 * Build a comprehensive index of all markdown files
 * Maps various name formats to actual file paths
 */
async function buildFileIndex(): Promise<Map<string, string>> {
  const files = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  const index = new Map<string, string>();

  for (const file of files) {
    const normalizedPath = file.replace(/\\/g, '/');

    // Index by full path (without .md)
    const withoutExt = normalizedPath.replace(/\.md$/, '');
    index.set(withoutExt.toLowerCase(), normalizedPath);

    // Index by filename only
    const basename = path.basename(file, '.md').toLowerCase();
    if (!index.has(basename)) {
      index.set(basename, normalizedPath);
    }

    // Index by filename with directory hint
    const dirName = path.dirname(normalizedPath).split('/').pop() || '';
    const dirBasename = `${dirName}/${basename}`.toLowerCase();
    index.set(dirBasename, normalizedPath);
  }

  return index;
}

/**
 * Search for a file that matches the given link
 */
function findMatchingFile(
  link: string,
  sourceFile: string,
  fileIndex: Map<string, string>,
  allFiles: string[]
): string | null {
  // Clean up the link
  let searchPath = link
    .replace(/^\.\//, '')
    .replace(/^\.\.\//, '')
    .replace(/\.md$/, '')
    .replace(/#.*$/, ''); // Remove anchor

  // If empty after cleanup, skip
  if (!searchPath) return null;

  const searchLower = searchPath.toLowerCase();

  // Try exact match in index
  if (fileIndex.has(searchLower)) {
    return fileIndex.get(searchLower)!;
  }

  // Try with common directory prefixes
  const commonDirs = ['interventions', 'conditions', 'reference', 'reference-databases', 'features', 'community/partners', 'clinical-trials'];
  for (const dir of commonDirs) {
    const withDir = `${dir}/${path.basename(searchPath)}`.toLowerCase();
    if (fileIndex.has(withDir)) {
      return fileIndex.get(withDir)!;
    }
  }

  // Try basename only
  const basename = path.basename(searchPath).toLowerCase();
  if (fileIndex.has(basename)) {
    return fileIndex.get(basename)!;
  }

  // Fuzzy search - find files containing the search term
  const matches = allFiles.filter(f => {
    const fLower = f.toLowerCase();
    const fBasename = path.basename(f, '.md').toLowerCase();
    return fBasename === basename ||
           fBasename.includes(basename) ||
           basename.includes(fBasename);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  // If multiple matches, prefer exact basename match
  const exactMatch = matches.find(f =>
    path.basename(f, '.md').toLowerCase() === basename
  );
  if (exactMatch) {
    return exactMatch;
  }

  return null;
}

/**
 * Calculate correct relative path from source to target
 */
function getRelativePath(sourceFile: string, targetFile: string): string {
  const sourceDir = path.dirname(sourceFile);
  let relativePath = path.relative(sourceDir, targetFile);

  // Normalize to forward slashes
  relativePath = relativePath.replace(/\\/g, '/');

  // Keep .md extension for source files (11ty transform strips it during build)

  // Ensure relative paths start with ./ or ../
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

/**
 * Check if a file exists (with .md extension handling)
 */
function fileExists(link: string, sourceFile: string): boolean {
  const sourceDir = path.dirname(path.join(workspaceRoot, sourceFile));

  // Remove anchor
  const linkPath = link.replace(/#.*$/, '');

  // Try as-is
  let fullPath = path.resolve(sourceDir, linkPath);
  if (fs.existsSync(fullPath)) return true;

  // Try with .md
  if (!linkPath.endsWith('.md')) {
    fullPath = path.resolve(sourceDir, linkPath + '.md');
    if (fs.existsSync(fullPath)) return true;
  }

  // Try index.md in directory
  fullPath = path.resolve(sourceDir, linkPath, 'index.md');
  if (fs.existsSync(fullPath)) return true;

  return false;
}

/**
 * Fix internal links in a single file
 */
async function fixInternalLinksInFile(
  filePath: string,
  fileIndex: Map<string, string>,
  allFiles: string[],
  dryRun: boolean
): Promise<FixResult> {
  const fullPath = path.join(workspaceRoot, filePath);
  const result: FixResult = { file: filePath, fixes: [] };

  if (!fs.existsSync(fullPath)) {
    return result;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  // Match internal links (not http/https, not mailto, etc.)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    let newLine = line;
    let match;

    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(line)) !== null) {
      const [fullMatch, linkText, url] = match;

      // Skip external links, anchors-only, mailto, etc.
      if (url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('mailto:') ||
          url.startsWith('tel:') ||
          url.startsWith('#') ||
          url.startsWith('data:')) {
        continue;
      }

      // Skip if file already exists
      if (fileExists(url, filePath)) {
        continue;
      }

      // Try to find the correct file
      const foundFile = findMatchingFile(url, filePath, fileIndex, allFiles);

      if (foundFile) {
        // Extract anchor if present
        const anchorMatch = url.match(/#(.+)$/);
        const anchor = anchorMatch ? '#' + anchorMatch[1] : '';

        const correctPath = getRelativePath(filePath, foundFile) + anchor;

        if (correctPath !== url) {
          const newMatch = `[${linkText}](${correctPath})`;
          newLine = newLine.replace(fullMatch, newMatch);

          result.fixes.push({
            line: lineNum,
            original: url,
            replacement: correctPath,
            reason: `Found at ${foundFile}`,
          });

          modified = true;
        }
      }
    }

    lines[i] = newLine;
  }

  if (modified && !dryRun) {
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
  }

  return result;
}

/**
 * Find and report all broken internal links
 */
async function findBrokenLinks(
  fileIndex: Map<string, string>,
  allFiles: string[]
): Promise<Map<string, string[]>> {
  const brokenByFile = new Map<string, string[]>();

  const mdFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  for (const filePath of mdFiles) {
    const fullPath = path.join(workspaceRoot, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    const broken: string[] = [];

    while ((match = linkRegex.exec(content)) !== null) {
      const [, , url] = match;

      // Skip external links
      if (url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('mailto:') ||
          url.startsWith('tel:') ||
          url.startsWith('#') ||
          url.startsWith('data:')) {
        continue;
      }

      if (!fileExists(url, filePath)) {
        const foundFile = findMatchingFile(url, filePath, fileIndex, allFiles);
        if (!foundFile) {
          broken.push(url);
        }
      }
    }

    if (broken.length > 0) {
      brokenByFile.set(filePath, broken);
    }
  }

  return brokenByFile;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const reportOnly = args.includes('--report');

  console.log('🔗 Fix Internal Links Script');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  // Build file index
  console.log('Building file index...');
  const fileIndex = await buildFileIndex();

  const allFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  console.log(`Indexed ${fileIndex.size} entries from ${allFiles.length} files\n`);

  if (reportOnly) {
    // Just report broken links
    console.log('Finding broken internal links...\n');
    const brokenLinks = await findBrokenLinks(fileIndex, allFiles);

    if (brokenLinks.size === 0) {
      console.log('✅ No broken internal links found!');
    } else {
      console.log(`Found broken links in ${brokenLinks.size} files:\n`);
      for (const [file, links] of brokenLinks) {
        console.log(`📄 ${file}:`);
        for (const link of links) {
          console.log(`   ❌ ${link}`);
        }
      }
    }
    return;
  }

  // Fix links
  console.log('Scanning and fixing internal links...\n');

  let totalFixes = 0;
  let filesFixed = 0;
  const allResults: FixResult[] = [];

  for (const file of allFiles) {
    const result = await fixInternalLinksInFile(file, fileIndex, allFiles, dryRun);

    if (result.fixes.length > 0) {
      allResults.push(result);
      filesFixed++;
      totalFixes += result.fixes.length;

      console.log(`📄 ${file}:`);
      for (const fix of result.fixes) {
        console.log(`   Line ${fix.line}: ${fix.original}`);
        console.log(`        → ${fix.replacement}`);
        console.log(`          (${fix.reason})`);
      }
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files fixed: ${filesFixed}`);
  console.log(`Total fixes: ${totalFixes}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply fixes.');
  } else if (totalFixes > 0) {
    console.log('\n✅ Fixes applied! Run npm run validate-links to verify.');
  } else {
    console.log('\n✅ No broken internal links found that could be auto-fixed.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
