import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');

interface BrokenLink {
  sourceFile: string;
  sourceLine: number;
  brokenPath: string;
}

// Parse the broken links report
function parseBrokenLinksReport(): BrokenLink[] {
  const reportPath = path.join(workspaceRoot, 'BROKEN_INTERNAL_LINKS.md');
  if (!fs.existsSync(reportPath)) {
    console.error('Broken links report not found');
    return [];
  }

  const content = fs.readFileSync(reportPath, 'utf-8');
  const links: BrokenLink[] = [];
  const lines = content.split('\n');

  let currentSource = '';
  for (const line of lines) {
    const sourceMatch = line.match(/^Source: (.+):(\d+)$/);
    if (sourceMatch) {
      currentSource = sourceMatch[1];
      const sourceLine = parseInt(sourceMatch[2], 10);

      // Look for the broken path on the next line
      const nextLineIndex = lines.indexOf(line) + 1;
      if (nextLineIndex < lines.length) {
        const brokenMatch = lines[nextLineIndex].match(/^Broken: (.+)$/);
        if (brokenMatch) {
          links.push({
            sourceFile: currentSource,
            sourceLine,
            brokenPath: brokenMatch[1]
          });
        }
      }
    }
  }

  return links;
}

// Find a file in the repository by filename
async function findFile(filename: string): Promise<string | null> {
  try {
    const pattern = `**/${filename}`;
    const files = await glob(pattern, {
      cwd: workspaceRoot,
      ignore: ['node_modules/**', '_site/**', '.git/**']
    });

    return files.length > 0 ? files[0] : null;
  } catch (error) {
    return null;
  }
}

// Calculate relative path from source to target
function getRelativePath(from: string, to: string): string {
  const fromDir = path.dirname(from);
  let relativePath = path.relative(fromDir, to);

  // Normalize to forward slashes
  relativePath = relativePath.replace(/\\/g, '/');

  // Ensure it starts with ./
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

// Fix a broken link in a file
function fixLinkInFile(sourceFile: string, brokenPath: string, correctPath: string): boolean {
  const fullSourcePath = path.join(workspaceRoot, sourceFile);

  if (!fs.existsSync(fullSourcePath)) {
    console.warn(`  ⚠ Source file not found: ${sourceFile}`);
    return false;
  }

  let content = fs.readFileSync(fullSourcePath, 'utf-8');
  const originalContent = content;

  // Try to replace the broken link
  // Handle different markdown link formats
  const escapedBroken = brokenPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try various replacement patterns
  const patterns = [
    new RegExp(`\\]\\(${escapedBroken}\\)`, 'g'),
    new RegExp(`\\]\\(${escapedBroken}#[^)]+\\)`, 'g'), // With anchor
    new RegExp(`!\\[([^\\]]*)\\]\\(${escapedBroken}\\)`, 'g'), // Image
  ];

  let replaced = false;
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, (match) => {
        // Preserve the link text and anchor if present
        const anchorMatch = match.match(/#([^)]+)\)/);
        const anchor = anchorMatch ? `#${anchorMatch[1]}` : '';
        const imageMatch = match.match(/^!\[([^\]]*)\]/);
        const prefix = imageMatch ? `![${imageMatch[1]}]` : ']';

        return `${prefix}(${correctPath}${anchor})`;
      });
      replaced = true;
      break;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(fullSourcePath, content, 'utf-8');
    return true;
  }

  return false;
}

// Main function
async function main() {
  console.log('🔧 Automated Link Fixer\n');
  console.log('Loading broken links report...');

  const brokenLinks = parseBrokenLinksReport();
  console.log(`Found ${brokenLinks.length} broken links to fix\n`);

  let fixed = 0;
  let notFound = 0;
  let failed = 0;

  for (const link of brokenLinks) {
    const filename = path.basename(link.brokenPath);

    // Skip certain types of links
    if (link.brokenPath.startsWith('mailto:') ||
        link.brokenPath.startsWith('http') ||
        link.brokenPath.startsWith('ttps:') ||
        filename === 'file.md' ||
        link.brokenPath.includes('/folder/')) {
      console.log(`⏭ Skipping: ${link.brokenPath}`);
      continue;
    }

    console.log(`\n🔍 Fixing: ${link.brokenPath}`);
    console.log(`   Source: ${link.sourceFile}:${link.sourceLine}`);

    // Try to find the file
    const foundPath = await findFile(filename);

    if (!foundPath) {
      console.log(`   ❌ File not found: ${filename}`);
      notFound++;
      continue;
    }

    console.log(`   ✓ Found at: ${foundPath}`);

    // Calculate correct relative path
    const correctPath = getRelativePath(link.sourceFile, foundPath);
    console.log(`   → Correct path: ${correctPath}`);

    // Fix the link
    const success = fixLinkInFile(link.sourceFile, link.brokenPath, correctPath);

    if (success) {
      console.log(`   ✅ Fixed!`);
      fixed++;
    } else {
      console.log(`   ⚠ Could not replace in file`);
      failed++;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Not found: ${notFound}`);
  console.log(`⚠ Failed to replace: ${failed}`);
  console.log(`📝 Total processed: ${brokenLinks.length}`);
}

main().catch(console.error);
