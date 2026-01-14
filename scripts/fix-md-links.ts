import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const workspaceRoot = path.resolve(__dirname, '..');
let filesModified = 0;
let linksFixed = 0;

interface LinkFix {
  file: string;
  oldLink: string;
  newLink: string;
}

const fixes: LinkFix[] = [];

// Files to skip
const SKIP_FILES = [
  'node_modules/**',
  '_site/**',
  '.git/**',
  'CLAUDE.md',
  'broken-links-report.md'
];

// Fix .md links in markdown content
function fixMdLinks(content: string, filePath: string): { content: string; modified: boolean } {
  let modified = false;
  const relativePath = path.relative(workspaceRoot, filePath);

  let newContent = content;

  // Match markdown inline links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  newContent = newContent.replace(linkRegex, (match, text, url) => {
    // Skip external links, anchors, mailto, etc.
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('#')
    ) {
      return match;
    }

    // Check if URL ends with .md or .md#anchor
    const mdMatch = url.match(/^(.+)\.md(#.+)?$/);
    if (!mdMatch) {
      return match;
    }

    const urlPath = mdMatch[1];
    const anchor = mdMatch[2] || '';

    // Determine the new URL
    let newUrl: string;

    if (url.startsWith('/')) {
      // Root-relative: /path/file.md -> /path/file/
      newUrl = `${urlPath}/${anchor}`;
    } else if (url.startsWith('./') || url.startsWith('../')) {
      // Relative: ./file.md -> ./file/ or ../file.md -> ../file/
      newUrl = `${urlPath}/${anchor}`;
    } else {
      // No prefix: file.md -> file/
      newUrl = `${urlPath}/${anchor}`;
    }

    if (newUrl !== url) {
      modified = true;
      linksFixed++;
      fixes.push({
        file: relativePath,
        oldLink: url,
        newLink: newUrl
      });
    }

    return `[${text}](${newUrl})`;
  });

  // Match reference-style links: [1]: url or [label]: url
  const refLinkRegex = /^(\[[^\]]+\]:\s+)(.+)$/gm;
  newContent = newContent.replace(refLinkRegex, (match, prefix, url) => {
    // Skip external links, anchors, mailto, etc.
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('#')
    ) {
      return match;
    }

    // Check if URL ends with .md or .md#anchor
    const mdMatch = url.match(/^(.+)\.md(#.+)?$/);
    if (!mdMatch) {
      return match;
    }

    const urlPath = mdMatch[1];
    const anchor = mdMatch[2] || '';

    // Determine the new URL
    let newUrl: string;

    if (url.startsWith('/')) {
      // Root-relative: /path/file.md -> /path/file/
      newUrl = `${urlPath}/${anchor}`;
    } else if (url.startsWith('./') || url.startsWith('../')) {
      // Relative: ./file.md -> ./file/ or ../file.md -> ../file/
      newUrl = `${urlPath}/${anchor}`;
    } else {
      // No prefix: file.md -> file/
      newUrl = `${urlPath}/${anchor}`;
    }

    if (newUrl !== url) {
      modified = true;
      linksFixed++;
      fixes.push({
        file: relativePath,
        oldLink: url,
        newLink: newUrl
      });
    }

    return `${prefix}${newUrl}`;
  });

  return { content: newContent, modified };
}

// Process a single markdown file
async function processMarkdownFile(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // Parse frontmatter
    const { content: markdownContent, data: frontmatter } = matter(content);

    // Fix links in markdown content
    const { content: fixedContent, modified } = fixMdLinks(markdownContent, filePath);

    if (modified) {
      // Reconstruct file with frontmatter
      const newFileContent = matter.stringify(fixedContent, frontmatter);
      await fs.promises.writeFile(filePath, newFileContent, 'utf-8');
      filesModified++;

      const relativePath = path.relative(workspaceRoot, filePath);
      console.log(`✓ Fixed: ${relativePath}`);
    }
  } catch (error: any) {
    console.error(`Error processing ${filePath}: ${error.message}`);
  }
}

// Process HTML template files (Nunjucks)
async function processTemplateFile(filePath: string): Promise<void> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // Fix links in template
    const { content: fixedContent, modified } = fixMdLinks(content, filePath);

    if (modified) {
      await fs.promises.writeFile(filePath, fixedContent, 'utf-8');
      filesModified++;

      const relativePath = path.relative(workspaceRoot, filePath);
      console.log(`✓ Fixed: ${relativePath}`);
    }
  } catch (error: any) {
    console.error(`Error processing ${filePath}: ${error.message}`);
  }
}

// Main function
async function main() {
  console.log('🔧 Fixing .md Links in Source Files\n');

  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // Find all markdown files
  console.log('Finding markdown files...');
  const mdFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    absolute: true,
    ignore: SKIP_FILES
  });

  // Find template files
  console.log('Finding template files...');
  const templateFiles = await glob('{_includes,_layouts}/**/*.{njk,html}', {
    cwd: workspaceRoot,
    absolute: true,
    ignore: SKIP_FILES
  });

  const allFiles = [...mdFiles, ...templateFiles];
  console.log(`Found ${allFiles.length} file(s) to process\n`);

  // Process each file
  for (const file of allFiles) {
    if (file.endsWith('.md')) {
      if (!dryRun) {
        await processMarkdownFile(file);
      } else {
        // Dry run: just check
        const content = await fs.promises.readFile(file, 'utf-8');
        const { content: markdownContent } = matter(content);
        const { modified } = fixMdLinks(markdownContent, file);
        if (modified && verbose) {
          console.log(`Would fix: ${path.relative(workspaceRoot, file)}`);
        }
      }
    } else {
      if (!dryRun) {
        await processTemplateFile(file);
      } else {
        // Dry run: just check
        const content = await fs.promises.readFile(file, 'utf-8');
        const { modified } = fixMdLinks(content, file);
        if (modified && verbose) {
          console.log(`Would fix: ${path.relative(workspaceRoot, file)}`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60) + '\n');

  if (dryRun) {
    console.log(`Would fix ${linksFixed} link(s) in ${filesModified} file(s)`);
  } else {
    console.log(`✅ Fixed ${linksFixed} link(s) in ${filesModified} file(s)`);
  }

  // Show detailed fixes if verbose or if there are few fixes
  if (verbose || fixes.length <= 20) {
    if (fixes.length > 0) {
      console.log('\nDetailed changes:');
      fixes.forEach(fix => {
        console.log(`  ${fix.file}:`);
        console.log(`    ${fix.oldLink} → ${fix.newLink}`);
      });
    }
  } else if (fixes.length > 20) {
    console.log(`\n(Use --verbose to see all ${fixes.length} changes)`);
  }

  console.log('');
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
