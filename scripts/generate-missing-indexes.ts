import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const workspaceRoot = path.resolve(__dirname, '..');
let indexesCreated = 0;

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  '_site',
  '.git',
  '.github',
  '.obsidian',
  '.cursor',
  '.vscode',
  'scripts',
  '_includes',
  '_layouts',
  '_data',
  'css',
  'assets'
];

// Top-level directories that are handled by section-indexes.njk
// Don't generate index.md for these - they already have auto-generated index pages
const SECTION_INDEX_DIRS = [
  'features',
  'benefits',
  'problems',
  'strategy',
  'regulatory',
  'reference',
  'economic-models',
  'community',
  'clinical-trials',
  'careers',
  'proposals',
  'interventions',
  'conditions',
  'reference-databases'
];

// Get all markdown files in a directory (non-recursive, immediate children only)
function getMarkdownFilesInDir(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md' && entry.name !== 'README.md') {
        files.push(entry.name);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return files;
}

// Get all subdirectories in a directory (non-recursive, immediate children only)
function getSubdirectories(dirPath: string): string[] {
  const dirs: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
        dirs.push(entry.name);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return dirs;
}

// Create title from directory name
function createTitle(dirName: string): string {
  return dirName
    .split('-')
    .map(word => {
      // Handle special cases
      if (word.toLowerCase() === 'fda') return 'FDA';
      if (word.toLowerCase() === 'ehr') return 'EHR';
      if (word.toLowerCase() === 'cfr') return 'CFR';
      if (word.toLowerCase() === 'irb') return 'IRB';
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Get title from markdown file
function getTitleFromFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    if (data.title) {
      return data.title;
    }

    // Fallback to filename
    const basename = path.basename(filePath, '.md');
    return createTitle(basename);
  } catch (error) {
    const basename = path.basename(filePath, '.md');
    return createTitle(basename);
  }
}

// Generate index.md content for a directory
function generateIndexContent(dirPath: string, relativePath: string): string {
  const dirName = path.basename(dirPath);
  const title = createTitle(dirName);

  const mdFiles = getMarkdownFilesInDir(dirPath);
  const subdirs = getSubdirectories(dirPath);

  // Convert Windows paths to URL paths
  const urlPath = relativePath.replace(/\\/g, '/');

  let content = `---
title: "${title}"
description: "Index of ${title.toLowerCase()} resources"
published: true
date: '${new Date().toISOString()}'
permalink: "/${urlPath}/"
---

# ${title}

`;

  // Add subdirectories section
  if (subdirs.length > 0) {
    content += `## Sections\n\n`;
    subdirs.forEach(subdir => {
      const subdirTitle = createTitle(subdir);
      // Use absolute paths to avoid relative path resolution issues
      content += `- [${subdirTitle}](/${urlPath}/${subdir}/)\n`;
    });
    content += `\n`;
  }

  // Add pages section
  if (mdFiles.length > 0) {
    content += `## Pages\n\n`;
    mdFiles.forEach(file => {
      const filePath = path.join(dirPath, file);
      const fileTitle = getTitleFromFile(filePath);
      const fileBasename = path.basename(file, '.md');
      // Use absolute paths to avoid relative path resolution issues
      content += `- [${fileTitle}](/${urlPath}/${fileBasename}/)\n`;
    });
    content += `\n`;
  }

  if (mdFiles.length === 0 && subdirs.length === 0) {
    content += `This section is currently empty.\n`;
  }

  return content;
}

// Find all directories that need an index.md
async function findDirectoriesNeedingIndex(): Promise<string[]> {
  const allDirs: Set<string> = new Set();

  // Find all markdown files
  const mdFiles = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', '**/scripts/**']
  });

  // For each markdown file, add its directory
  mdFiles.forEach(file => {
    const dir = path.dirname(file);
    if (dir && dir !== '.') {
      allDirs.add(dir);

      // Also add parent directories
      let currentDir = dir;
      while (currentDir && currentDir !== '.' && currentDir.includes(path.sep)) {
        currentDir = path.dirname(currentDir);
        if (currentDir && currentDir !== '.') {
          allDirs.add(currentDir);
        }
      }
    }
  });

  // Filter to only directories that don't have an index.md
  const dirsNeedingIndex: string[] = [];

  for (const dir of allDirs) {
    const indexPath = path.join(workspaceRoot, dir, 'index.md');
    const readmePath = path.join(workspaceRoot, dir, 'README.md');

    // Check if a same-named .md file exists at the parent level (e.g., act.md for act/ directory)
    const dirBasename = path.basename(dir);
    const parentDir = path.dirname(dir);
    const parentPath = parentDir === '.' ? workspaceRoot : path.join(workspaceRoot, parentDir);
    const sameNamedMdFile = path.join(parentPath, `${dirBasename}.md`);
    const hasSameNamedFile = fs.existsSync(sameNamedMdFile);

    // Skip top-level directories handled by section-indexes.njk
    const isTopLevelSectionDir = !dir.includes(path.sep) && !dir.includes('/') && SECTION_INDEX_DIRS.includes(dir);

    if (!fs.existsSync(indexPath) && !fs.existsSync(readmePath) && !hasSameNamedFile && !isTopLevelSectionDir) {
      const fullDirPath = path.join(workspaceRoot, dir);
      const mdFiles = getMarkdownFilesInDir(fullDirPath);
      const subdirs = getSubdirectories(fullDirPath);

      // Only create index if there are files or subdirectories
      if (mdFiles.length > 0 || subdirs.length > 0) {
        dirsNeedingIndex.push(dir);
      }
    }
  }

  return dirsNeedingIndex.sort();
}

// Main function
async function main() {
  console.log('🔍 Finding directories that need index.md files...\n');

  const dryRun = process.argv.includes('--dry-run');

  const dirsNeedingIndex = await findDirectoriesNeedingIndex();

  if (dirsNeedingIndex.length === 0) {
    console.log('✅ All directories already have index files!\n');
    return;
  }

  console.log(`Found ${dirsNeedingIndex.length} director${dirsNeedingIndex.length === 1 ? 'y' : 'ies'} needing index.md:\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN - Would create:\n');
    dirsNeedingIndex.forEach(dir => {
      console.log(`  ${dir}/index.md`);
    });
  } else {
    for (const dir of dirsNeedingIndex) {
      const fullDirPath = path.join(workspaceRoot, dir);
      const indexPath = path.join(fullDirPath, 'index.md');

      const content = generateIndexContent(fullDirPath, dir);

      fs.writeFileSync(indexPath, content, 'utf-8');
      indexesCreated++;

      console.log(`✓ Created: ${dir}/index.md`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60) + '\n');

  if (dryRun) {
    console.log(`Would create ${dirsNeedingIndex.length} index.md file(s)`);
  } else {
    console.log(`✅ Created ${indexesCreated} index.md file(s)`);
  }

  console.log('');
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
