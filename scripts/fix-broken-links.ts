/**
 * Fix Broken Links Script
 *
 * Automatically fixes addressable link validation errors:
 * 1. Converts MediaWiki-style anchors to kebab-case (e.g., #How_to_Download → #how-to-download)
 * 2. Optionally removes 404 external links
 * 3. Optionally removes broken image references
 *
 * Usage:
 *   npm run fix-broken-links              # Fix anchors only (safe)
 *   npm run fix-broken-links -- --dry-run # Preview changes without modifying
 *   npm run fix-broken-links -- --remove-404-links  # Also remove 404 external links
 *   npm run fix-broken-links -- --remove-broken-images # Also remove broken images
 *   npm run fix-broken-links -- --all     # Fix everything
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');

interface FixResult {
  file: string;
  fixes: Array<{
    type: 'anchor' | 'external-link' | 'image';
    original: string;
    replacement: string;
    line: number;
  }>;
}

// MediaWiki URL encoding map
const MEDIAWIKI_DECODE_MAP: Record<string, string> = {
  '.2C': ',',
  '.26': '&',
  '.2F': '/',
  '.28': '(',
  '.29': ')',
  '.3F': '?',
  '.3A': ':',
  '.27': "'",
  '.22': '"',
  '.25': '%',
  '.2B': '+',
  '.3D': '=',
  '.C3.82': '', // Â - remove this artifact
  '.C3.A2': '', // â - remove this artifact
  '.C2.A0': ' ', // Non-breaking space
  // UTF-8 multi-byte sequences for special characters
  '.E2.80.99': "'", // Right single quote '
  '.E2.80.98': "'", // Left single quote '
  '.E2.80.9C': '"', // Left double quote "
  '.E2.80.9D': '"', // Right double quote "
  '.E2.80.93': '-', // En dash –
  '.E2.80.94': '-', // Em dash —
  '.E2.80.A6': '...', // Ellipsis …
  '.E2.84.A2': '', // Trademark ™ - remove
  '.C2.AE': '', // Registered ® - remove
  '.C2.A9': '', // Copyright © - remove
  '.E2.82.AC': '', // Euro € - remove (often appears as artifact)
};

// Unicode characters to normalize in anchors
const UNICODE_NORMALIZE_MAP: Record<string, string> = {
  '\u2019': "'", // Right single quote '
  '\u2018': "'", // Left single quote '
  '\u201C': '"', // Left double quote "
  '\u201D': '"', // Right double quote "
  '\u2013': '-', // En dash –
  '\u2014': '-', // Em dash —
  '\u2026': '', // Ellipsis …
  '\u2122': '', // Trademark ™
  '\u00AE': '', // Registered ®
  '\u00A9': '', // Copyright ©
  '\u20AC': '', // Euro €
  '\u00A0': ' ', // Non-breaking space
};

/**
 * Decode MediaWiki-style URL encoding
 */
function decodeMediaWikiEncoding(str: string): string {
  let result = str;

  // Replace known MediaWiki encodings
  for (const [encoded, decoded] of Object.entries(MEDIAWIKI_DECODE_MAP)) {
    result = result.split(encoded).join(decoded);
  }

  // Handle generic percent-encoding that wasn't caught above
  try {
    result = decodeURIComponent(result.replace(/\./g, '%'));
  } catch {
    // If decoding fails, just use what we have
  }

  return result;
}

/**
 * Normalize Unicode characters in a string
 */
function normalizeUnicode(str: string): string {
  let result = str;
  for (const [unicode, replacement] of Object.entries(UNICODE_NORMALIZE_MAP)) {
    result = result.split(unicode).join(replacement);
  }
  return result;
}

/**
 * Convert MediaWiki-style anchor to kebab-case
 * Example: #How_to_Download_and_Share_Your_Data → #how-to-download-and-share-your-data
 */
function convertMediaWikiAnchorToKebab(anchor: string): string {
  if (!anchor.startsWith('#')) {
    return anchor;
  }

  let slug = anchor.substring(1);

  // First decode any MediaWiki URL encoding
  slug = decodeMediaWikiEncoding(slug);

  // Normalize Unicode characters (smart quotes, em-dashes, etc.)
  slug = normalizeUnicode(slug);

  // Convert to kebab-case
  slug = slug
    .toLowerCase()
    .replace(/_/g, '-')        // Underscores to hyphens
    .replace(/\s+/g, '-')      // Spaces to hyphens
    .replace(/[.,()'"]/g, '')  // Remove punctuation (matches markdown-it-anchor behavior)
    .replace(/--+/g, '-')      // Collapse multiple hyphens
    .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens

  return '#' + slug;
}

/**
 * Check if an anchor looks like MediaWiki style
 */
function isMediaWikiAnchor(anchor: string): boolean {
  if (!anchor.startsWith('#')) return false;

  const slug = anchor.substring(1);

  // MediaWiki anchors have underscores or URL-encoded characters
  return (
    slug.includes('_') ||
    /\.[0-9A-F]{2}/i.test(slug) || // URL encoding like .2C
    /[A-Z]/.test(slug) // Has uppercase (kebab-case is lowercase)
  );
}

/**
 * Parse the broken links report to extract fixable issues
 */
function parseReportForFixableAnchors(reportPath: string): Map<string, Array<{ line: number; original: string; suggested: string }>> {
  const fileToAnchors = new Map<string, Array<{ line: number; original: string; suggested: string }>>();

  if (!fs.existsSync(reportPath)) {
    return fileToAnchors;
  }

  const content = fs.readFileSync(reportPath, 'utf-8');
  const lines = content.split('\n');

  let currentFile = '';

  for (const line of lines) {
    // Match file headers like "### clinical-trials/open-humans.md"
    const fileMatch = line.match(/^### (.+\.md)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    // Match broken anchor lines with suggestions
    // Example: - [ ] **INTERNAL** `#How_to_Download` - Broken anchor: #How_to_Download - Did you mean: how-to-download? (line 8)
    const anchorMatch = line.match(
      /\*\*INTERNAL\*\* `(#[^`]+)` - Broken anchor: (#[^\s]+) - Did you mean: ([^?]+)\? \(line (\d+)\)/
    );

    if (anchorMatch && currentFile) {
      const [, original, , suggested, lineNum] = anchorMatch;

      if (!fileToAnchors.has(currentFile)) {
        fileToAnchors.set(currentFile, []);
      }

      // Take the first suggestion if multiple are provided
      const firstSuggestion = suggested.split(',')[0].trim();

      fileToAnchors.get(currentFile)!.push({
        line: parseInt(lineNum, 10),
        original,
        suggested: '#' + firstSuggestion,
      });
    }
  }

  return fileToAnchors;
}

/**
 * Fix anchors in a single file
 */
async function fixAnchorsInFile(
  filePath: string,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Find markdown links with anchors: [text](#anchor) or [text](file#anchor)
    const linkRegex = /\[([^\]]+)\]\(([^)]*#[^)]+)\)/g;
    let match;
    let newLine = line;

    while ((match = linkRegex.exec(line)) !== null) {
      const [fullMatch, text, url] = match;

      // Extract anchor part
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) continue;

      const anchor = url.substring(hashIndex);
      const pathPart = url.substring(0, hashIndex);

      if (isMediaWikiAnchor(anchor)) {
        const newAnchor = convertMediaWikiAnchorToKebab(anchor);

        if (newAnchor !== anchor) {
          const newUrl = pathPart + newAnchor;
          const newMatch = `[${text}](${newUrl})`;

          newLine = newLine.replace(fullMatch, newMatch);

          result.fixes.push({
            type: 'anchor',
            original: anchor,
            replacement: newAnchor,
            line: lineNum,
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
 * Remove or comment out 404 external links
 */
async function fixExternalLinksInFile(
  filePath: string,
  brokenUrls: Set<string>,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Find markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    let newLine = line;

    while ((match = linkRegex.exec(line)) !== null) {
      const [fullMatch, text, url] = match;

      // Check if this URL is in our broken list
      if (brokenUrls.has(url)) {
        // Replace link with just the text (removes the broken link but keeps text)
        newLine = newLine.replace(fullMatch, text);

        result.fixes.push({
          type: 'external-link',
          original: fullMatch,
          replacement: text,
          line: lineNum,
        });

        modified = true;
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
 * Remove broken image references
 */
async function fixImagesInFile(
  filePath: string,
  brokenImages: Set<string>,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Find markdown images: ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    let newLine = line;

    while ((match = imageRegex.exec(line)) !== null) {
      const [fullMatch, alt, url] = match;

      if (brokenImages.has(url)) {
        // Remove the entire image reference
        newLine = newLine.replace(fullMatch, '');

        result.fixes.push({
          type: 'image',
          original: fullMatch,
          replacement: '',
          line: lineNum,
        });

        modified = true;
      }
    }

    // Clean up empty lines left behind
    lines[i] = newLine;
  }

  if (modified && !dryRun) {
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
  }

  return result;
}

/**
 * Parse broken links report to extract 404 URLs
 */
function parse404UrlsFromReport(reportPath: string): Map<string, Set<string>> {
  const fileToUrls = new Map<string, Set<string>>();

  if (!fs.existsSync(reportPath)) {
    return fileToUrls;
  }

  const content = fs.readFileSync(reportPath, 'utf-8');
  const lines = content.split('\n');

  let currentFile = '';

  for (const line of lines) {
    const fileMatch = line.match(/^### (.+\.md)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    // Match 404 links: - [ ] **LINK** [url](url) - Status: 404 (line X)
    const linkMatch = line.match(/\*\*LINK\*\* \[([^\]]+)\]\([^)]+\) - Status: 404/);
    if (linkMatch && currentFile) {
      const url = linkMatch[1];

      if (!fileToUrls.has(currentFile)) {
        fileToUrls.set(currentFile, new Set());
      }
      fileToUrls.get(currentFile)!.add(url);
    }
  }

  return fileToUrls;
}

/**
 * Parse broken images from report
 */
function parseBrokenImagesFromReport(reportPath: string): Map<string, Set<string>> {
  const fileToImages = new Map<string, Set<string>>();

  if (!fs.existsSync(reportPath)) {
    return fileToImages;
  }

  const content = fs.readFileSync(reportPath, 'utf-8');
  const lines = content.split('\n');

  let currentFile = '';

  for (const line of lines) {
    const fileMatch = line.match(/^### (.+\.md)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    // Match broken images: - [ ] **IMAGE** [url](url) - Status: 404 (line X)
    const imageMatch = line.match(/\*\*IMAGE\*\* \[([^\]]+)\]\([^)]+\) - Status: 404/);
    if (imageMatch && currentFile) {
      const url = imageMatch[1];

      if (!fileToImages.has(currentFile)) {
        fileToImages.set(currentFile, new Set());
      }
      fileToImages.get(currentFile)!.add(url);
    }
  }

  return fileToImages;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const remove404Links = args.includes('--remove-404-links') || args.includes('--all');
  const removeBrokenImages = args.includes('--remove-broken-images') || args.includes('--all');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('🔧 Fix Broken Links Script');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  console.log('Options:');
  console.log(`  - Fix MediaWiki anchors: YES (always)`);
  console.log(`  - Remove 404 external links: ${remove404Links ? 'YES' : 'NO (use --remove-404-links)'}`);
  console.log(`  - Remove broken images: ${removeBrokenImages ? 'YES' : 'NO (use --remove-broken-images)'}`);
  console.log('');

  const reportPath = path.join(workspaceRoot, 'broken-links-report.md');

  // Get all markdown files
  const mdFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  console.log(`Found ${mdFiles.length} markdown files\n`);

  // Parse report for additional context
  const file404Urls = parse404UrlsFromReport(reportPath);
  const fileBrokenImages = parseBrokenImagesFromReport(reportPath);

  let totalAnchorFixes = 0;
  let totalLinkFixes = 0;
  let totalImageFixes = 0;
  const allResults: FixResult[] = [];

  for (const file of mdFiles) {
    // Fix anchors
    const anchorResult = await fixAnchorsInFile(file, dryRun);

    // Fix 404 links if enabled
    let linkResult: FixResult = { file, fixes: [] };
    if (remove404Links && file404Urls.has(file)) {
      linkResult = await fixExternalLinksInFile(file, file404Urls.get(file)!, dryRun);
    }

    // Fix broken images if enabled
    let imageResult: FixResult = { file, fixes: [] };
    if (removeBrokenImages && fileBrokenImages.has(file)) {
      imageResult = await fixImagesInFile(file, fileBrokenImages.get(file)!, dryRun);
    }

    // Combine results
    const combinedFixes = [
      ...anchorResult.fixes,
      ...linkResult.fixes,
      ...imageResult.fixes,
    ];

    if (combinedFixes.length > 0) {
      const result: FixResult = { file, fixes: combinedFixes };
      allResults.push(result);

      console.log(`📄 ${file}:`);
      for (const fix of combinedFixes) {
        const prefix = fix.type === 'anchor' ? '🔗' : fix.type === 'external-link' ? '🌐' : '🖼️';
        console.log(`  ${prefix} Line ${fix.line}: ${fix.original} → ${fix.replacement || '(removed)'}`);
      }
      console.log('');

      totalAnchorFixes += anchorResult.fixes.length;
      totalLinkFixes += linkResult.fixes.length;
      totalImageFixes += imageResult.fixes.length;
    }
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files with fixes: ${allResults.length}`);
  console.log(`  - Anchor fixes: ${totalAnchorFixes}`);
  console.log(`  - External link removals: ${totalLinkFixes}`);
  console.log(`  - Image removals: ${totalImageFixes}`);
  console.log(`Total fixes: ${totalAnchorFixes + totalLinkFixes + totalImageFixes}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply fixes.');
  } else {
    console.log('\n✅ Fixes applied! Run npm run validate-links to verify.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
