/**
 * Fix Old Wiki URLs Script
 *
 * Converts links to wiki.crowdsourcingcures.org and wiki.curedao.org
 * to relative paths pointing to pages in this wiki.
 *
 * Usage:
 *   npm run fix-wiki-urls              # Apply fixes
 *   npm run fix-wiki-urls -- --dry-run # Preview changes without modifying
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');

interface FixResult {
  file: string;
  fixes: Array<{
    original: string;
    replacement: string;
    pageName: string;
    matchedFile: string | null;
    line: number;
  }>;
}

// Build an index of all markdown files for quick lookup
async function buildFileIndex(): Promise<Map<string, string>> {
  const files = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  const index = new Map<string, string>();

  for (const file of files) {
    // Get the filename without extension
    const basename = path.basename(file, '.md').toLowerCase();

    // Store both the kebab-case name and potential variations
    index.set(basename, file);

    // Also index without common suffixes for better matching
    const withoutSuffix = basename
      .replace(/-page$/, '')
      .replace(/-article$/, '');
    if (withoutSuffix !== basename) {
      index.set(withoutSuffix, file);
    }
  }

  return index;
}

/**
 * Convert MediaWiki page name to kebab-case
 * Example: All_of_Us_Research_Program → all-of-us-research-program
 */
function pageNameToKebab(pageName: string): string {
  return pageName
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()'".,]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract page name from old wiki URL
 */
function extractPageName(url: string): string | null {
  // Pattern 1: wiki.crowdsourcingcures.org/wiki/Page_Name
  // Pattern 2: wiki.curedao.org/en/wiki/Page_Name
  const wikiMatch = url.match(/wiki\.(crowdsourcingcures|curedao)\.org(?:\/en)?\/wiki\/([^"\s#?]+)/);
  if (wikiMatch) {
    return decodeURIComponent(wikiMatch[2]);
  }

  // Pattern 3: index.php?title=Page_Name&action=edit
  const indexMatch = url.match(/wiki\.(crowdsourcingcures|curedao)\.org\/index\.php\?title=([^&"]+)/);
  if (indexMatch) {
    return decodeURIComponent(indexMatch[2]);
  }

  // Pattern 4: wiki.curedao.org/en/ecosystem/... or similar paths
  const pathMatch = url.match(/wiki\.(crowdsourcingcures|curedao)\.org(?:\/en)?\/([^"\s#?]+)/);
  if (pathMatch) {
    // Get the last segment of the path
    const segments = pathMatch[2].split('/');
    return segments[segments.length - 1];
  }

  return null;
}

/**
 * Find the best matching file for a page name
 */
function findMatchingFile(pageName: string, fileIndex: Map<string, string>): string | null {
  const kebabName = pageNameToKebab(pageName);

  // Direct match
  if (fileIndex.has(kebabName)) {
    return fileIndex.get(kebabName)!;
  }

  // Try common variations
  const variations = [
    kebabName,
    kebabName.replace(/-/g, ''),
    kebabName.replace(/s$/, ''), // Remove trailing 's'
    kebabName + 's', // Add trailing 's'
  ];

  for (const variation of variations) {
    if (fileIndex.has(variation)) {
      return fileIndex.get(variation)!;
    }
  }

  // Try partial match (file contains the page name)
  for (const [key, file] of fileIndex.entries()) {
    if (key.includes(kebabName) || kebabName.includes(key)) {
      // Only match if they share significant overlap
      const shorter = key.length < kebabName.length ? key : kebabName;
      const longer = key.length < kebabName.length ? kebabName : key;
      if (longer.includes(shorter) && shorter.length > 5) {
        return file;
      }
    }
  }

  return null;
}

/**
 * Calculate relative path from source file to target file
 */
function getRelativePath(sourceFile: string, targetFile: string): string {
  const sourceDir = path.dirname(sourceFile);
  let relativePath = path.relative(sourceDir, targetFile);

  // Normalize to forward slashes
  relativePath = relativePath.replace(/\\/g, '/');

  // Remove .md extension for cleaner URLs
  relativePath = relativePath.replace(/\.md$/, '');

  // Ensure it starts with ./ for relative paths in same or child directories
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

/**
 * Fix wiki URLs in a single file
 */
async function fixWikiUrlsInFile(
  filePath: string,
  fileIndex: Map<string, string>,
  dryRun: boolean = false
): Promise<FixResult> {
  const fullPath = path.join(workspaceRoot, filePath);
  const result: FixResult = { file: filePath, fixes: [] };

  if (!fs.existsSync(fullPath)) {
    return result;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  // Regex to match markdown links with old wiki URLs
  const wikiUrlRegex = /\[([^\]]*)\]\((https?:\/\/wiki\.(crowdsourcingcures|curedao)\.org[^)]*)\)/g;

  // Regex to match image links wrapped with wiki File: URLs
  // Pattern: [![alt](img-src)](wiki-file-url)
  const wikiImageLinkRegex = /\[!\[([^\]]*)\]\(([^)]+)\)\]\((https?:\/\/wiki\.(crowdsourcingcures|curedao)\.org\/wiki\/File:[^)]*)\)/g;

  // Regex to match empty "Enlarge" links
  const enlargeLinkRegex = /\[\]\((https?:\/\/wiki\.(crowdsourcingcures|curedao)\.org\/wiki\/File:[^)]*)\s*"Enlarge"\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    let newLine = line;
    let match;

    // First, handle image links wrapped with wiki File: URLs
    // Convert [![alt](img)](wiki-url) to just ![alt](img)
    wikiImageLinkRegex.lastIndex = 0;
    while ((match = wikiImageLinkRegex.exec(line)) !== null) {
      const [fullMatch, alt, imgSrc, wikiUrl] = match;
      const replacement = `![${alt}](${imgSrc})`;
      newLine = newLine.replace(fullMatch, replacement);

      result.fixes.push({
        original: wikiUrl,
        replacement: '(image link removed)',
        pageName: 'File:' + imgSrc.split('/').pop(),
        matchedFile: null,
        line: lineNum,
      });
      modified = true;
    }

    // Remove empty "Enlarge" links entirely
    enlargeLinkRegex.lastIndex = 0;
    while ((match = enlargeLinkRegex.exec(newLine)) !== null) {
      const [fullMatch, wikiUrl] = match;
      newLine = newLine.replace(fullMatch, '');

      result.fixes.push({
        original: wikiUrl,
        replacement: '(enlarge link removed)',
        pageName: 'Enlarge link',
        matchedFile: null,
        line: lineNum,
      });
      modified = true;
    }

    // Now handle regular wiki page links
    wikiUrlRegex.lastIndex = 0;

    while ((match = wikiUrlRegex.exec(newLine)) !== null) {
      const [fullMatch, linkText, url] = match;

      // Skip if this is a File: URL (already handled above)
      if (url.includes('/wiki/File:')) {
        continue;
      }

      const pageName = extractPageName(url);

      if (!pageName) {
        continue;
      }

      const matchedFile = findMatchingFile(pageName, fileIndex);
      let replacement: string;

      if (matchedFile) {
        // Found a matching file - create relative link
        const relativePath = getRelativePath(filePath, matchedFile);
        replacement = `[${linkText}](${relativePath})`;
      } else {
        // No matching file - keep just the text (remove the broken link)
        replacement = linkText;
      }

      newLine = newLine.replace(fullMatch, replacement);

      result.fixes.push({
        original: url,
        replacement: matchedFile ? getRelativePath(filePath, matchedFile) : '(text only)',
        pageName,
        matchedFile,
        line: lineNum,
      });

      modified = true;
    }

    lines[i] = newLine;
  }

  if (modified && !dryRun) {
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('🔗 Fix Old Wiki URLs Script');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  // Build file index
  console.log('Building file index...');
  const fileIndex = await buildFileIndex();
  console.log(`Indexed ${fileIndex.size} files\n`);

  // Get all markdown files (excluding the report)
  const mdFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  console.log(`Scanning ${mdFiles.length} markdown files...\n`);

  let totalFixes = 0;
  let filesFixed = 0;
  let linksFound = 0;
  let linksReplaced = 0;
  let linksRemoved = 0;
  const allResults: FixResult[] = [];

  for (const file of mdFiles) {
    const result = await fixWikiUrlsInFile(file, fileIndex, dryRun);

    if (result.fixes.length > 0) {
      allResults.push(result);
      filesFixed++;

      console.log(`📄 ${file}:`);
      for (const fix of result.fixes) {
        linksFound++;
        if (fix.matchedFile) {
          linksReplaced++;
          console.log(`  ✅ "${fix.pageName}" → ${fix.replacement}`);
        } else {
          linksRemoved++;
          console.log(`  ⚠️  "${fix.pageName}" → (no match, link removed)`);
        }
        if (verbose) {
          console.log(`      Original: ${fix.original}`);
        }
      }
      console.log('');

      totalFixes += result.fixes.length;
    }
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files with wiki URLs: ${filesFixed}`);
  console.log(`Total wiki links found: ${linksFound}`);
  console.log(`  - Replaced with relative paths: ${linksReplaced}`);
  console.log(`  - Removed (no matching page): ${linksRemoved}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply fixes.');
  } else if (totalFixes > 0) {
    console.log('\n✅ Fixes applied! Run npm run validate-links to verify.');
  } else {
    console.log('\n✅ No wiki URLs found to fix.');
  }

  // Show unmatched pages for reference
  if (linksRemoved > 0) {
    console.log('\n📋 Pages not found (you may want to create these):');
    const unmatchedPages = new Set<string>();
    for (const result of allResults) {
      for (const fix of result.fixes) {
        if (!fix.matchedFile) {
          unmatchedPages.add(fix.pageName);
        }
      }
    }
    for (const page of Array.from(unmatchedPages).sort()) {
      console.log(`   - ${page} (would be: ${pageNameToKebab(page)}.md)`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
