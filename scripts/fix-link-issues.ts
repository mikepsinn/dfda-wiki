/**
 * Fix Link Issues Script
 *
 * Comprehensive script to fix various link validation issues:
 * 1. Wikipedia links with escaped parentheses
 * 2. Internal anchor mismatches (using suggestions from report)
 * 3. Other malformed URLs
 *
 * Usage:
 *   npx ts-node scripts/fix-link-issues.ts              # Apply all fixes
 *   npx ts-node scripts/fix-link-issues.ts --dry-run    # Preview changes
 *   npx ts-node scripts/fix-link-issues.ts --anchors    # Fix anchors only
 *   npx ts-node scripts/fix-link-issues.ts --wikipedia  # Fix Wikipedia only
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');

interface Fix {
  file: string;
  line: number;
  type: string;
  original: string;
  replacement: string;
}

const allFixes: Fix[] = [];

/**
 * Fix Wikipedia links with escaped parentheses
 * Changes: [text](https://en.wikipedia.org/wiki/Page_\(term\))
 * To:      [text](https://en.wikipedia.org/wiki/Page_(term))
 */
function fixWikipediaLinks(content: string, filePath: string): string {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match Wikipedia links with escaped parentheses
    // Pattern: [text](https://en.wikipedia.org/wiki/Something_\(term\))
    const wikiRegex = /\[([^\]]+)\]\((https:\/\/en\.wikipedia\.org\/wiki\/[^)]*\\[\(\)][^)]*)\)/g;
    let match;
    let newLine = line;

    while ((match = wikiRegex.exec(line)) !== null) {
      const [fullMatch, text, url] = match;
      // Remove backslash escapes from the URL
      const fixedUrl = url.replace(/\\([()])/g, '$1');
      const fixedMatch = `[${text}](${fixedUrl})`;

      if (fullMatch !== fixedMatch) {
        newLine = newLine.replace(fullMatch, fixedMatch);
        allFixes.push({
          file: filePath,
          line: i + 1,
          type: 'wikipedia',
          original: fullMatch,
          replacement: fixedMatch
        });
      }
    }

    lines[i] = newLine;
  }

  return lines.join('\n');
}

/**
 * Known anchor fixes from the broken-links-report
 * Maps file -> array of { linkPattern, replacement }
 */
const ANCHOR_FIXES: Record<string, Array<{ pattern: string; replacement: string }>> = {
  'benefits/overall-economic-benefits.md': [
    { pattern: '#2-earlier-access-7-years-sooner', replacement: '#2-earlier-access-7-years-sooner' }, // The heading slug
    { pattern: '#annual-benefits-summary', replacement: '#7-putting-it-all-together' },
    { pattern: '#references', replacement: '#8-conclusion' }, // No references section, link to conclusion
  ],
  'clinical-trials/open-humans.md': [
    { pattern: '#mairi-dulaney---web-admin--operations-volunteer', replacement: '#mairi-dulaney---web-admin-operations-volunteer' },
  ],
  'features/data-silo-api-gateways.md': [
    { pattern: '#personalfda-nodes', replacement: '/features/personal-fda-nodes' }, // Link to actual page
  ],
  'reference/benefits-of-exercise.md': [
    { pattern: '#alzheimers', replacement: "#alzheimer's" },
  ],
  'reference/open-epidemiology-initiative.md': [
    { pattern: '#institute-for-health-metrics-and-evaluation-global-health-data-exchange-ghdx', replacement: '#institute-for-health-metrics-and-evaluation-global-health-data-exchange-ghdx' },
  ],
  'reference/public-money-public-code-initiative.md': [
    { pattern: '#protecting-the-peoples-data', replacement: "#protecting-the-people's-data" },
    { pattern: '#myth-proprietary-software-is-secure-and-not-prone-to-attacks', replacement: '#myth-proprietary-software-is-secure-and-not-prone-to-attacks' },
  ],
};

/**
 * Fix known anchor mismatches
 */
function fixKnownAnchors(content: string, filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fixes = ANCHOR_FIXES[normalizedPath];

  if (!fixes) return content;

  const lines = content.split('\n');

  for (const fix of fixes) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match markdown links containing this anchor
      const pattern = fix.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
      const regex = new RegExp(`\\[([^\\]]+)\\]\\(${pattern}\\)`, 'g');

      if (regex.test(line)) {
        const newLine = line.replace(regex, `[$1](${fix.replacement})`);
        if (newLine !== line) {
          allFixes.push({
            file: filePath,
            line: i + 1,
            type: 'anchor',
            original: fix.pattern,
            replacement: fix.replacement
          });
          lines[i] = newLine;
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Process a single file
 */
async function processFile(filePath: string, dryRun: boolean, options: { anchors: boolean; wikipedia: boolean }): Promise<boolean> {
  const fullPath = path.join(workspaceRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const originalContent = content;

  if (options.wikipedia) {
    content = fixWikipediaLinks(content, filePath);
  }

  if (options.anchors) {
    content = fixKnownAnchors(content, filePath);
  }

  if (content !== originalContent) {
    if (!dryRun) {
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
    return true;
  }

  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const anchorsOnly = args.includes('--anchors');
  const wikipediaOnly = args.includes('--wikipedia');

  const options = {
    anchors: !wikipediaOnly || anchorsOnly,
    wikipedia: !anchorsOnly || wikipediaOnly
  };

  // If neither flag specified, do both
  if (!anchorsOnly && !wikipediaOnly) {
    options.anchors = true;
    options.wikipedia = true;
  }

  console.log('Link Issue Fixer');
  console.log('================');
  if (dryRun) {
    console.log('DRY RUN - No files will be modified\n');
  }

  console.log('Options:');
  console.log(`  Fix anchors: ${options.anchors ? 'YES' : 'NO'}`);
  console.log(`  Fix Wikipedia links: ${options.wikipedia ? 'YES' : 'NO'}`);
  console.log('');

  // Get all markdown files
  const mdFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  console.log(`Scanning ${mdFiles.length} markdown files...\n`);

  let filesModified = 0;

  for (const file of mdFiles) {
    const modified = await processFile(file, dryRun, options);
    if (modified) {
      filesModified++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  if (allFixes.length === 0) {
    console.log('No issues found to fix!');
    return;
  }

  // Group by file
  const byFile = new Map<string, Fix[]>();
  for (const fix of allFixes) {
    if (!byFile.has(fix.file)) {
      byFile.set(fix.file, []);
    }
    byFile.get(fix.file)!.push(fix);
  }

  for (const [file, fixes] of byFile) {
    console.log(`\n${file}:`);
    for (const fix of fixes) {
      console.log(`  Line ${fix.line} [${fix.type}]:`);
      console.log(`    - ${fix.original}`);
      console.log(`    + ${fix.replacement}`);
    }
  }

  console.log(`\nTotal: ${allFixes.length} fixes in ${filesModified} files`);

  if (dryRun) {
    console.log('\nDRY RUN - Run without --dry-run to apply fixes');
  } else {
    console.log('\nFixes applied! Run npm run validate-links to verify.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
