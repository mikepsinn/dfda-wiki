/**
 * Convert HTML files to Markdown
 *
 * This script:
 * 1. Finds all HTML content files (excluding _site, node_modules, calculator)
 * 2. Extracts frontmatter from HTML comments
 * 3. Converts HTML body to Markdown
 * 4. Determines appropriate folder based on content
 * 5. Writes .md files with proper frontmatter
 * 6. Generates Vercel redirects
 * 7. Deletes original HTML files
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import TurndownService from 'turndown';

const ROOT_DIR = path.join(__dirname, '..');
const VERCEL_CONFIG_PATH = path.join(ROOT_DIR, 'vercel.json');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || DRY_RUN;

// Files to skip (functional apps, not content)
const SKIP_FILES = [
  'strategy/1-percent-treaty/calculator/index.html'
];

// Initialize Turndown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

// Custom rules for better conversion
turndownService.addRule('figure', {
  filter: 'figure',
  replacement: function(content, node) {
    const img = (node as Element).querySelector('img');
    if (img) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      return `\n![${alt}](${src})\n`;
    }
    return content;
  }
});

interface ConversionResult {
  originalPath: string;
  newPath: string;
  title: string;
  success: boolean;
  error?: string;
}

interface Frontmatter {
  title: string;
  description: string;
  published: boolean;
  date: string;
  tags: string;
  editor: string;
  dateCreated: string;
  [key: string]: string | boolean;
}

/**
 * Extract frontmatter from HTML comment at the start of the file
 */
function extractFrontmatter(htmlContent: string): { frontmatter: Frontmatter; body: string } {
  const commentMatch = htmlContent.match(/^<!--\s*([\s\S]*?)-->\s*/);

  const defaultFrontmatter: Frontmatter = {
    title: 'Untitled',
    description: '',
    published: true,
    date: new Date().toISOString(),
    tags: '',
    editor: 'markdown',
    dateCreated: new Date().toISOString()
  };

  if (!commentMatch) {
    return { frontmatter: defaultFrontmatter, body: htmlContent };
  }

  const commentContent = commentMatch[1];
  const body = htmlContent.slice(commentMatch[0].length);

  // Parse the frontmatter from the comment
  const frontmatter = { ...defaultFrontmatter };
  const lines = commentContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Handle boolean values
      if (value === 'true') {
        frontmatter[key] = true;
      } else if (value === 'false') {
        frontmatter[key] = false;
      } else {
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, body };
}

/**
 * Convert filename to kebab-case
 */
function toKebabCase(filename: string): string {
  return filename
    .replace(/\.html$/, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[()]/g, '')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Determine the appropriate folder for wiki content based on the content/title
 */
function determineTargetFolder(frontmatter: Frontmatter, originalPath: string): string {
  const relativePath = path.relative(ROOT_DIR, originalPath);
  const dir = path.dirname(relativePath);

  // If already in a non-wiki folder, keep it there
  if (dir !== 'wiki' && dir !== '.') {
    return dir;
  }

  // For wiki files, try to categorize based on title/content
  const title = frontmatter.title.toLowerCase();
  const tags = (frontmatter.tags || '').toLowerCase();

  // Insurance companies
  if (['aetna', 'anthem', 'cigna', 'humana', 'centene', 'kaiser permanente', 'health care service corporation'].some(
    name => title.includes(name.toLowerCase())
  )) {
    return 'community/partners';
  }

  // Interventions/drugs/supplements
  if (['adderall', 'ketamine', 'bpc-157', 'bromantane', 'dmso', 'pea', 'parnate', 'nardil', 'isrib',
       'l-tyrosine', 'alcar', 'r-ala', '9-me-bc', 'larazotide'].some(name => title.includes(name.toLowerCase())) ||
      tags.includes('supplement') || tags.includes('drug') || tags.includes('nootropic')) {
    return 'interventions';
  }

  // Conditions/diseases
  if (['anhedonia', 'add', 'attention deficit', 'alzheimer', 'dementia', 'long covid', 'leaky gut',
       'intestinal permeability', 'neuroinflammation'].some(name => title.includes(name.toLowerCase())) ||
      tags.includes('condition') || tags.includes('disease')) {
    return 'conditions';
  }

  // Health measurements/biomarkers
  if (['blood pressure', 'heart rate', 'hrv', 'glucose', 'blood glucose', 'ic50', 'mao'].some(
    name => title.includes(name.toLowerCase())
  )) {
    return 'reference-databases';
  }

  // Research projects/programs
  if (['all of us', 'research program', 'open humans', 'open cures', 'research workbench',
       'crowdsourced research', 'microbiome optimization', 'nutrition for precision'].some(
    name => title.includes(name.toLowerCase())
  )) {
    return 'clinical-trials';
  }

  // Technology/development
  if (['api', 'application programming', 'federated learning', 'homomorphic encryption',
       'development', 'gnu health', 'habit dash'].some(name => title.includes(name.toLowerCase())) ||
      tags.includes('development') || tags.includes('technology')) {
    return 'features';
  }

  // Organizations/partners
  if (['longecity', 'dementia society', 'open food facts', 'million friends', 'omada',
       'vitadao', 'dao', 'fiscal sponsor', 'joint venture'].some(name => title.includes(name.toLowerCase())) ||
      tags.includes('organization') || tags.includes('partner')) {
    return 'community/partners';
  }

  // Grants/funding
  if (['grant', 'funding'].some(name => title.includes(name.toLowerCase()))) {
    return 'economic-models';
  }

  // Reference/general info
  if (['benefits of', 'discoveries', 'differentiation', 'medical ethics'].some(
    name => title.includes(name.toLowerCase())
  )) {
    return 'reference';
  }

  // Default: keep in reference folder for miscellaneous wiki content
  return 'reference';
}

/**
 * Generate YAML frontmatter string
 */
function generateFrontmatter(frontmatter: Frontmatter): string {
  const lines = ['---'];

  // Escape title and description if they contain colons
  const title = frontmatter.title.includes(':') ? `"${frontmatter.title.replace(/"/g, '\\"')}"` : frontmatter.title;
  const description = frontmatter.description?.includes(':')
    ? `"${frontmatter.description.replace(/"/g, '\\"')}"`
    : frontmatter.description || '';

  lines.push(`title: ${title}`);
  lines.push(`description: ${description}`);
  lines.push(`published: ${frontmatter.published}`);
  lines.push(`date: '${frontmatter.date}'`);
  lines.push(`tags: ${frontmatter.tags || ''}`);
  lines.push(`editor: markdown`);
  lines.push(`dateCreated: '${frontmatter.dateCreated}'`);
  lines.push('---');

  return lines.join('\n');
}

/**
 * Convert a single HTML file to Markdown
 */
async function convertFile(htmlPath: string): Promise<ConversionResult> {
  const relativePath = path.relative(ROOT_DIR, htmlPath).replace(/\\/g, '/');

  try {
    // Read HTML file
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Extract frontmatter and body
    const { frontmatter, body } = extractFrontmatter(htmlContent);

    // Convert HTML to Markdown
    const markdown = turndownService.turndown(body);

    // Determine target folder
    const targetFolder = determineTargetFolder(frontmatter, htmlPath);

    // Generate kebab-case filename
    const originalFilename = path.basename(htmlPath);
    const kebabFilename = toKebabCase(originalFilename) + '.md';

    // Build new path
    const newPath = path.join(ROOT_DIR, targetFolder, kebabFilename);
    const newRelativePath = path.relative(ROOT_DIR, newPath).replace(/\\/g, '/');

    // Check if target file already exists
    if (fs.existsSync(newPath)) {
      return {
        originalPath: relativePath,
        newPath: newRelativePath,
        title: frontmatter.title,
        success: false,
        error: `Target file already exists: ${newRelativePath}`
      };
    }

    // Generate full content
    const fullContent = generateFrontmatter(frontmatter) + '\n\n' + markdown;

    if (DRY_RUN) {
      console.log(`\n[DRY RUN] Would convert:`);
      console.log(`  From: ${relativePath}`);
      console.log(`  To:   ${newRelativePath}`);
      console.log(`  Title: ${frontmatter.title}`);
    } else {
      // Ensure target directory exists
      const targetDir = path.dirname(newPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Write markdown file
      fs.writeFileSync(newPath, fullContent, 'utf-8');

      if (VERBOSE) {
        console.log(`Converted: ${relativePath} -> ${newRelativePath}`);
      }
    }

    return {
      originalPath: relativePath,
      newPath: newRelativePath,
      title: frontmatter.title,
      success: true
    };
  } catch (error) {
    return {
      originalPath: relativePath,
      newPath: '',
      title: 'Unknown',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Generate Vercel redirects
 */
function generateRedirects(results: ConversionResult[]): void {
  const successfulConversions = results.filter(r => r.success);

  if (successfulConversions.length === 0) {
    console.log('\nNo successful conversions, skipping redirect generation.');
    return;
  }

  // Read existing vercel.json
  let vercelConfig: { redirects?: Array<{ source: string; destination: string; permanent: boolean }> } = {};

  if (fs.existsSync(VERCEL_CONFIG_PATH)) {
    try {
      vercelConfig = JSON.parse(fs.readFileSync(VERCEL_CONFIG_PATH, 'utf-8'));
    } catch {
      console.warn('Warning: Could not parse existing vercel.json, creating new one');
    }
  }

  // Initialize redirects array if not present
  if (!vercelConfig.redirects) {
    vercelConfig.redirects = [];
  }

  // Add redirects for converted files
  for (const result of successfulConversions) {
    // Remove .html extension and create redirect
    const oldPath = '/' + result.originalPath.replace(/\.html$/, '');
    const newPath = '/' + result.newPath.replace(/\.md$/, '/');

    // Check if redirect already exists
    const existingRedirect = vercelConfig.redirects.find(r => r.source === oldPath);
    if (!existingRedirect) {
      vercelConfig.redirects.push({
        source: oldPath,
        destination: newPath,
        permanent: true
      });
    }
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would add ${successfulConversions.length} redirect(s) to vercel.json`);
    console.log('Sample redirects:');
    for (const result of successfulConversions.slice(0, 5)) {
      console.log(`  /${result.originalPath.replace(/\.html$/, '')} -> /${result.newPath.replace(/\.md$/, '/')}`);
    }
    if (successfulConversions.length > 5) {
      console.log(`  ... and ${successfulConversions.length - 5} more`);
    }
  } else {
    fs.writeFileSync(VERCEL_CONFIG_PATH, JSON.stringify(vercelConfig, null, 2), 'utf-8');
    console.log(`\nAdded ${successfulConversions.length} redirect(s) to vercel.json`);
  }
}

/**
 * Delete original HTML files
 */
function deleteOriginalFiles(results: ConversionResult[]): void {
  const successfulConversions = results.filter(r => r.success);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would delete ${successfulConversions.length} original HTML file(s)`);
    return;
  }

  let deleted = 0;
  for (const result of successfulConversions) {
    const fullPath = path.join(ROOT_DIR, result.originalPath);
    try {
      fs.unlinkSync(fullPath);
      deleted++;
    } catch (error) {
      console.error(`Error deleting ${result.originalPath}: ${error}`);
    }
  }

  console.log(`Deleted ${deleted} original HTML file(s)`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('HTML to Markdown Converter');
  console.log('==========================');
  if (DRY_RUN) {
    console.log('Running in DRY RUN mode - no files will be modified\n');
  }

  // Find all HTML files
  const htmlFiles = await glob('**/*.html', {
    cwd: ROOT_DIR,
    ignore: ['_site/**', 'node_modules/**', ...SKIP_FILES],
    absolute: true
  });

  console.log(`Found ${htmlFiles.length} HTML file(s) to convert\n`);

  if (htmlFiles.length === 0) {
    console.log('No HTML files found to convert.');
    return;
  }

  // Convert all files
  const results: ConversionResult[] = [];

  for (const htmlPath of htmlFiles) {
    const result = await convertFile(htmlPath);
    results.push(result);
  }

  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n==========================');
  console.log('CONVERSION SUMMARY');
  console.log('==========================');
  console.log(`Total files:     ${results.length}`);
  console.log(`Successful:      ${successful.length}`);
  console.log(`Failed/Skipped:  ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed conversions:');
    for (const result of failed) {
      console.log(`  ${result.originalPath}: ${result.error}`);
    }
  }

  // Generate redirects
  generateRedirects(results);

  // Delete original files (only if not dry run)
  deleteOriginalFiles(results);

  console.log('\nDone!');
}

main().catch(console.error);
