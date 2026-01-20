import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');

// Emoji suggestions based on folder names
const emojiMap: Record<string, string> = {
  'features': '⚙️',
  'analytics': '📊',
  'benefits': '✨',
  'problems': '🔍',
  'strategy': '🎯',
  'regulatory': '⚖️',
  'reference': '📚',
  'economic-models': '💰',
  'community': '🤝',
  'partners': '🤝',
  'clinical-trials': '🔬',
  'protocols': '📋',
  'careers': '💼',
  'proposals': '📝',
  'interventions': '💊',
  'conditions': '🩺',
  'reference-databases': '🗄️',
  'templates': '📄',
  'daos': '🏛️',
  'businesses': '🏢',
  'nonprofits': '🌐',
  'researchers': '👨‍🔬',
  'decentralized-methods': '🌐',
  'data-standards': '📐',
  'assets': '🎨',
  'diagrams': '📊',
};

interface IndexFile {
  path: string;
  relativePath: string;
  folderName: string;
  data: any;
  content: string;
}

async function findIndexFiles(): Promise<IndexFile[]> {
  const pattern = '**/index.md';
  const files = await glob(pattern, {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**']
  });

  const indexFiles: IndexFile[] = [];

  for (const file of files) {
    const fullPath = path.join(workspaceRoot, file);
    const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
    const { data, content } = matter(fileContent);

    // Skip if already using section-index layout
    if (data.layout === 'section-index.njk') {
      console.log(`⏭  Skipping ${file} (already using section-index layout)`);
      continue;
    }

    const folderName = path.basename(path.dirname(fullPath));

    indexFiles.push({
      path: fullPath,
      relativePath: file,
      folderName,
      data,
      content: content.trim()
    });
  }

  return indexFiles;
}

function generatePermalink(relativePath: string): string {
  // Convert file path to URL path
  // e.g., "features/analytics/index.md" -> "/features/analytics/"
  const urlPath = relativePath
    .replace(/\\/g, '/')
    .replace('/index.md', '/')
    .replace('index.md', '/');

  return urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
}

function suggestEmoji(folderName: string): string | undefined {
  return emojiMap[folderName.toLowerCase()];
}

function cleanTitle(title: string | undefined, folderName: string): string {
  if (title && title !== folderName) {
    return title;
  }

  // Convert folder name to title case
  return folderName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function convertIndexFile(indexFile: IndexFile): Promise<void> {
  const { data, content, path: filePath, relativePath, folderName } = indexFile;

  // Update frontmatter
  const updatedData = {
    ...data,
    title: cleanTitle(data.title, folderName),
    layout: 'section-index.njk',
    permalink: data.permalink || generatePermalink(relativePath),
  };

  // Add emoji if not present and we have a suggestion
  if (!updatedData.emoji) {
    const suggestedEmoji = suggestEmoji(folderName);
    if (suggestedEmoji) {
      updatedData.emoji = suggestedEmoji;
    }
  }

  // Clean up content - remove manual lists of pages
  let cleanedContent = content;

  // Remove common patterns like "## Pages" sections with lists
  cleanedContent = cleanedContent
    .replace(/##\s+Pages\s*\n+(?:[-*]\s+\[.*?\]\(.*?\)\s*\n*)+/gi, '')
    .replace(/##\s+Contents?\s*\n+(?:[-*]\s+\[.*?\]\(.*?\)\s*\n*)+/gi, '')
    .trim();

  // Generate new file content
  const newContent = matter.stringify(cleanedContent, updatedData);

  await fs.promises.writeFile(filePath, newContent, 'utf-8');
  console.log(`✅ Updated: ${relativePath}`);
}

async function main() {
  console.log('🔍 Finding index.md files...\n');
  const indexFiles = await findIndexFiles();

  if (indexFiles.length === 0) {
    console.log('No index files found to convert.');
    return;
  }

  console.log(`Found ${indexFiles.length} index file(s) to convert.\n`);

  for (const indexFile of indexFiles) {
    await convertIndexFile(indexFile);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Converted ${indexFiles.length} index file(s)`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
