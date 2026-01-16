/**
 * Generate OG images, infographics, and thumbnails for wiki articles
 *
 * Usage:
 *   npm run generate-images                   # Generate for all articles without images
 *   npm run generate-images -- --file health  # Generate for specific file(s)
 *   npm run generate-images -- --force        # Regenerate all images
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { generateAndSaveImages } from './lib/genai-image.js';
import { glob } from 'glob';

// Load environment variables
dotenv.config();

const ROOT_DIR = path.join(__dirname, '..');

// Content directories to scan
const CONTENT_DIRS = [
  'features',
  'benefits',
  'problems',
  'strategy',
  'regulatory',
  'economic-models',
  'community',
  'clinical-trials',
  'proposals',
  'reference',
  'conditions',
  'interventions',
  'reference-databases',
  'careers',
  'data-standards',
  'assets',
];

/**
 * Get all markdown posts from content directories
 */
async function getAllPosts(): Promise<string[]> {
  const patterns = CONTENT_DIRS.map(dir => `${dir}/**/*.md`);
  const posts: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: ROOT_DIR,
      ignore: ['**/node_modules/**', '**/_site/**', '**/index.md'],
      absolute: true,
    });
    posts.push(...files);
  }

  return posts;
}

/**
 * Generate OG image, infographic, and thumbnail for a single post
 * @param filePath Path to the markdown file
 * @param forceRegenerate If true, regenerate images even if they already exist
 */
async function generateImagesForPost(
  filePath: string,
  forceRegenerate = false
): Promise<void> {
  const relativePath = path.relative(ROOT_DIR, filePath);
  console.log(`\n[*] Processing: ${relativePath}`);

  // Read file with frontmatter
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(fileContent);

  // Skip if no title
  if (!frontmatter.title) {
    console.log(`[SKIP] No title for prompt generation`);
    return;
  }

  // Skip unpublished
  if (frontmatter.published === false) {
    console.log(`[SKIP] Not published`);
    return;
  }

  console.log(`  Title: ${frontmatter.title}`);

  // Get relative path for organizing images
  const fileName = path.basename(filePath, '.md');
  const dirName = path.dirname(relativePath);

  // Output directories
  const ogOutputDir = path.join(ROOT_DIR, 'assets', 'og-images', dirName);
  const infographicOutputDir = path.join(ROOT_DIR, 'assets', 'infographics', dirName);
  const thumbnailOutputDir = path.join(ROOT_DIR, 'assets', 'thumbnails', dirName);

  // Check if images already exist
  const ogImageFile = path.join(ogOutputDir, `${fileName}.jpg`);
  const infographicImageFile = path.join(infographicOutputDir, `${fileName}.jpg`);
  const thumbnailFile = path.join(thumbnailOutputDir, `${fileName}.jpg`);

  const hasOgImage = await fs.access(ogImageFile).then(() => true).catch(() => false);
  const hasInfographic = await fs.access(infographicImageFile).then(() => true).catch(() => false);
  const hasThumbnail = await fs.access(thumbnailFile).then(() => true).catch(() => false);

  // Skip if already has all images (unless forceRegenerate is true)
  if (!forceRegenerate && hasOgImage && hasInfographic && hasThumbnail) {
    console.log(`[SKIP] Already has all images (OG, infographic, thumbnail)`);
    return;
  }

  let ogImagePath: string | null = null;
  let infographicImagePath: string | null = null;
  let thumbnailPath: string | null = null;

  // Clean the full post content for image generation prompt
  const cleanedContent = body
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Prepare image metadata
  const imageMetadata = {
    title: frontmatter.title || 'dFDA Article',
    description: frontmatter.description || frontmatter.title || '',
    author: 'Decentralized FDA',
    copyright: `© ${new Date().getFullYear()} dfda.earth`,
    keywords: frontmatter.tags || [],
  };

  // Shared prompt for OG and thumbnail images
  const imagePrompt = `Create image illustrating the content below.
Style: Use a fun retro scientific black and white style.

Title: "${frontmatter.title}".

Full article content: ${cleanedContent}
`;

  // Generate OG image (optimized for social media thumbnails)
  if (!hasOgImage || forceRegenerate) {
    console.log(`  Generating OG image (16:9)...`);

    try {
      const ogFiles = await generateAndSaveImages({
        prompt: imagePrompt,
        aspectRatio: '16:9',
        outputDir: ogOutputDir,
        filePrefix: fileName,
        format: 'jpg',
        metadata: imageMetadata,
      });

      if (ogFiles && ogFiles.length > 0) {
        ogImagePath = path.relative(ROOT_DIR, ogFiles[0]).replace(/\\/g, '/');
        console.log(`  [OK] Generated OG image: ${ogImagePath}`);
      } else {
        console.log(`  [WARN] No OG image generated`);
      }
    } catch (error) {
      console.error(`  [ERROR] Failed to generate OG image:`, error);
    }
  }

  // Generate infographic (detailed, vertical page-like format)
  if (!hasInfographic || forceRegenerate) {
    console.log(`  Generating infographic (detailed)...`);
    const infographicPrompt = `Create a detailed infographic for an article titled "${frontmatter.title}".

Style: Fun black and white scientific illustration style.

Full article content: ${cleanedContent}

`;

    try {
      const infographicFiles = await generateAndSaveImages({
        prompt: infographicPrompt,
        aspectRatio: '3:4',
        outputDir: infographicOutputDir,
        filePrefix: fileName,
        format: 'jpg',
        metadata: imageMetadata,
      });

      if (infographicFiles && infographicFiles.length > 0) {
        infographicImagePath = path.relative(ROOT_DIR, infographicFiles[0]).replace(/\\/g, '/');
        console.log(`  [OK] Generated infographic: ${infographicImagePath}`);
      } else {
        console.log(`  [WARN] No infographic generated`);
      }
    } catch (error) {
      console.error(`  [ERROR] Failed to generate infographic:`, error);
    }
  }

  // Generate thumbnail (square 1:1, useful for podcasts, grids, social)
  if (!hasThumbnail || forceRegenerate) {
    console.log(`  Generating thumbnail (1:1)...`);

    try {
      const thumbnailFiles = await generateAndSaveImages({
        prompt: imagePrompt,
        aspectRatio: '1:1',
        outputDir: thumbnailOutputDir,
        filePrefix: fileName,
        format: 'jpg',
        metadata: imageMetadata,
      });

      if (thumbnailFiles && thumbnailFiles.length > 0) {
        thumbnailPath = path.relative(ROOT_DIR, thumbnailFiles[0]).replace(/\\/g, '/');
        console.log(`  [OK] Generated thumbnail: ${thumbnailPath}`);
      } else {
        console.log(`  [WARN] No thumbnail generated`);
      }
    } catch (error) {
      console.error(`  [ERROR] Failed to generate thumbnail:`, error);
    }
  }

  // Update frontmatter if we generated any new images
  if (ogImagePath || infographicImagePath || thumbnailPath) {
    const updatedFrontmatter = { ...frontmatter };

    // Ensure metadata structure exists
    if (!updatedFrontmatter.metadata) {
      updatedFrontmatter.metadata = {};
    }
    if (!updatedFrontmatter.metadata.media) {
      updatedFrontmatter.metadata.media = {};
    }

    // Add generated images to frontmatter
    if (ogImagePath) {
      updatedFrontmatter.metadata.media.ogImage = `/${ogImagePath}`;
    }
    if (infographicImagePath) {
      updatedFrontmatter.metadata.media.infographic = `/${infographicImagePath}`;
    }
    if (thumbnailPath) {
      updatedFrontmatter.metadata.media.thumbnail = `/${thumbnailPath}`;
    }

    // Write updated file
    const updatedContent = matter.stringify(body, updatedFrontmatter);
    await fs.writeFile(filePath, updatedContent, 'utf-8');

    console.log(`  [OK] Updated ${filePath}`);
  } else {
    console.log(`  [SKIP] No new images to add`);
  }
}

/**
 * Generate images for all blog posts
 */
async function generateAllPostImages(fileFilter?: string, forceRegenerate = false): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Generating OG images, infographics, and thumbnails for articles');
  console.log('='.repeat(60) + '\n');

  // Get all posts
  console.log('[*] Loading articles...');
  const allPosts = await getAllPosts();

  // Filter to specific file if provided
  let posts: string[];
  if (fileFilter) {
    const matchingPosts = allPosts.filter(f => f.toLowerCase().includes(fileFilter.toLowerCase()));
    if (matchingPosts.length === 0) {
      console.error(`ERROR: No posts found matching "${fileFilter}"`);
      console.error('\nAvailable posts:');
      allPosts.slice(0, 10).forEach(f => console.error(`  - ${path.relative(ROOT_DIR, f)}`));
      if (allPosts.length > 10) {
        console.error(`  ... and ${allPosts.length - 10} more`);
      }
      process.exit(1);
    }

    // Only process the first matching file when filter is provided
    posts = [matchingPosts[0]];

    if (matchingPosts.length > 1) {
      console.log(`[INFO] Found ${matchingPosts.length} matching files, processing only the first one:`);
      console.log(`  Selected: ${matchingPosts[0]}`);
      console.log(`  Skipped: ${matchingPosts.slice(1).join(', ')}\n`);
    } else {
      console.log(`[OK] Found 1 post matching "${fileFilter}"\n`);
    }
  } else {
    posts = allPosts;
    console.log(`[OK] Found ${posts.length} articles\n`);
  }

  let postsProcessed = 0;
  let postsGenerated = 0;
  let postsFailed = 0;

  // Force regeneration if processing a specific file
  const shouldForce = forceRegenerate || !!fileFilter;

  for (const filePath of posts) {
    try {
      postsProcessed++;
      await generateImagesForPost(filePath, shouldForce);
      postsGenerated++;
    } catch (error) {
      console.error(`[ERROR] Failed to process ${filePath}:`, error);
      postsFailed++;
      // Continue with next file
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Posts processed: ${postsProcessed}`);
  console.log(`  Posts with images generated: ${postsGenerated}`);
  console.log(`  Posts failed: ${postsFailed}`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log('🎨 Article Image Generator for dFDA Wiki');
  console.log('='.repeat(60));

  // Check for API key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('ERROR: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
    console.error('Please set your Google Gemini API key in .env file:');
    console.error('GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here');
    console.error('Get your API key from: https://aistudio.google.com/app/apikey');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);

  // Check for --force flag
  const forceIndex = args.indexOf('--force');
  const forceRegenerate = forceIndex !== -1;
  if (forceIndex !== -1) {
    args.splice(forceIndex, 1);
  }

  // Support both --file <name> and just <name> as positional argument
  let fileFilter: string | undefined;
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    // --file <name> syntax
    fileFilter = args[fileIndex + 1];
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    // Positional argument syntax
    fileFilter = args[0];
  }

  if (fileFilter) {
    console.log(`\nGenerating images for post matching: "${fileFilter}"\n`);
  }
  if (forceRegenerate) {
    console.log(`Force regeneration: ON\n`);
  }

  await generateAllPostImages(fileFilter, forceRegenerate);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
