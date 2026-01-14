import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface BrokenLink {
  sourceFile: string;
  href: string;
  linkText: string;
  reason: string;
}

const workspaceRoot = path.resolve(__dirname, '..');
const siteDir = path.join(workspaceRoot, '_site');
const brokenLinks: BrokenLink[] = [];

// Load Vercel redirects from vercel.json
interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
}

let vercelRedirects: VercelRedirect[] = [];

function loadVercelRedirects(): void {
  const vercelConfigPath = path.join(workspaceRoot, 'vercel.json');
  if (fs.existsSync(vercelConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
      vercelRedirects = config.redirects || [];
      console.log(`Loaded ${vercelRedirects.length} Vercel redirect(s)\n`);
    } catch (error) {
      console.warn('Warning: Could not load vercel.json redirects');
    }
  }
}

// Apply Vercel redirects to a URL
function applyVercelRedirects(href: string): string {
  let currentHref = href;

  // Normalize relative paths to root-relative for redirect matching
  let normalizedHref = href;
  if (href.startsWith('./')) {
    normalizedHref = '/' + href.slice(2);
  } else if (!href.startsWith('/') && !href.startsWith('../')) {
    normalizedHref = '/' + href;
  }

  for (const redirect of vercelRedirects) {
    // Convert Vercel pattern to regex
    // :path* matches zero or more path segments (like /a/b/c or /a or empty)
    // :path matches a single path segment
    let pattern = redirect.source
      .replace(/:\w+\*/g, '(.*)') // :path* -> match anything
      .replace(/:\w+/g, '([^/]+)') // :path -> match one segment
      .replace(/\./g, '\\.'); // Escape dots

    const regex = new RegExp(`^${pattern}$`);
    const match = normalizedHref.match(regex);

    if (match) {
      // Apply the redirect destination
      let destination = redirect.destination;

      // Replace :path* and :path with captured groups
      const captured = match.slice(1); // All captured groups

      // Replace wildcards in destination
      destination = destination.replace(/:\w+\*/g, () => captured.shift() || '');
      destination = destination.replace(/:\w+/g, () => captured.shift() || '');

      // Convert back to relative format if original was relative
      if (href.startsWith('./')) {
        currentHref = './' + destination.slice(1);
      } else if (!href.startsWith('/')) {
        currentHref = destination.slice(1);
      } else {
        currentHref = destination;
      }

      break;
    }
  }

  return currentHref;
}

// Extract all links from an HTML file
function extractLinks(htmlContent: string, filePath: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];

  // Match <a href="...">text</a> tags
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim(); // Strip HTML tags from link text

    // Skip external links, mailto, tel, javascript, and template variables
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      href.startsWith('#') || // Same-page anchors
      href.includes('{{') ||
      href.includes('{%')
    ) {
      continue;
    }

    links.push({ href, text });
  }

  return links;
}

// Check if a link target exists in the build folder
function validateLink(href: string, sourceFile: string): { valid: boolean; reason?: string } {
  // Remove query strings and fragments
  let cleanHref = href.split('?')[0].split('#')[0];

  // Apply Vercel redirects
  const originalHref = cleanHref;
  cleanHref = applyVercelRedirects(cleanHref);

  let fullPath: string;

  // Handle root-relative URLs (starting with /)
  if (cleanHref.startsWith('/')) {
    // Root-relative: resolve from _site root
    const relativePath = cleanHref.slice(1); // Remove leading /
    fullPath = path.join(siteDir, relativePath);
  } else if (path.isAbsolute(cleanHref)) {
    // Absolute path (shouldn't happen in normal links)
    fullPath = cleanHref;
  } else {
    // Relative URL: resolve from source file's directory
    const sourceDir = path.dirname(sourceFile);
    fullPath = path.join(sourceDir, cleanHref);
  }

  // Empty or root path
  if (!cleanHref || cleanHref === '/') {
    // Check for index.html at root
    const indexPath = path.join(siteDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return { valid: true };
    }
    return { valid: false, reason: 'Root index.html not found' };
  }

  // Check if exact path exists
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      return { valid: true };
    }
    if (stat.isDirectory()) {
      // Check for index.html in directory
      const indexPath = path.join(fullPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Directory exists but no index.html found' };
    }
  }

  // Try adding .html extension
  const withHtml = fullPath + '.html';
  if (fs.existsSync(withHtml)) {
    return { valid: true };
  }

  // Try as directory with index.html
  const asDir = path.join(fullPath, 'index.html');
  if (fs.existsSync(asDir)) {
    return { valid: true };
  }

  // Try removing trailing slash and adding .html
  const withoutSlashPath = fullPath.replace(/\/$/, '') + '.html';
  if (fs.existsSync(withoutSlashPath)) {
    return { valid: true };
  }

  // Generate relative path for error message
  const relPath = path.relative(siteDir, fullPath).replace(/\\/g, '/');
  return { valid: false, reason: `File not found (tried: ${relPath}, ${relPath}.html, ${relPath}/index.html)` };
}

// Validate all links in an HTML file
function validateHtmlFile(filePath: string): void {
  const relativePath = path.relative(siteDir, filePath).replace(/\\/g, '/');

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const links = extractLinks(content, filePath);

    if (links.length === 0) {
      return;
    }

    for (const { href, text } of links) {
      const validation = validateLink(href, filePath);

      if (!validation.valid) {
        brokenLinks.push({
          sourceFile: relativePath,
          href,
          linkText: text,
          reason: validation.reason || 'Unknown error'
        });
      }
    }
  } catch (error: any) {
    console.error(`Error processing ${relativePath}: ${error.message}`);
  }
}

// Generate a markdown report
function generateReport(): string {
  const lines: string[] = [];

  lines.push('# Post-Build Link Validation Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (brokenLinks.length === 0) {
    lines.push('✅ **No broken links found!**');
    return lines.join('\n');
  }

  lines.push(`## Summary`);
  lines.push('');
  lines.push(`❌ **${brokenLinks.length} broken link(s) found**`);
  lines.push('');

  // Group by source file
  const byFile = new Map<string, BrokenLink[]>();
  brokenLinks.forEach(link => {
    if (!byFile.has(link.sourceFile)) {
      byFile.set(link.sourceFile, []);
    }
    byFile.get(link.sourceFile)!.push(link);
  });

  lines.push('## Broken Links by Page');
  lines.push('');

  byFile.forEach((links, file) => {
    lines.push(`### ${file}`);
    lines.push('');
    links.forEach(link => {
      lines.push(`- **Link text:** "${link.linkText}"`);
      lines.push(`  - **Target:** \`${link.href}\``);
      lines.push(`  - **Reason:** ${link.reason}`);
      lines.push('');
    });
  });

  return lines.join('\n');
}

// Main function
async function main() {
  console.log('🔍 Post-Build Link Validator\n');

  // Load Vercel redirects
  loadVercelRedirects();

  // Check if build directory exists
  if (!fs.existsSync(siteDir)) {
    console.error(`❌ Build directory not found: ${siteDir}`);
    console.error('   Run "npm run build" first to generate the site.');
    process.exit(1);
  }

  console.log(`📁 Scanning build directory: ${siteDir}\n`);

  // Find all HTML files in _site
  const htmlFiles = await glob('**/*.html', {
    cwd: siteDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/_pagefind/**']
  });

  console.log(`Found ${htmlFiles.length} HTML file(s)\n`);

  // Validate each HTML file
  let processedCount = 0;
  for (const file of htmlFiles) {
    validateHtmlFile(file);
    processedCount++;

    if (processedCount % 10 === 0) {
      process.stdout.write(`\rProcessed ${processedCount}/${htmlFiles.length} files...`);
    }
  }

  if (htmlFiles.length >= 10) {
    process.stdout.write(`\rProcessed ${processedCount}/${htmlFiles.length} files...\n`);
  }

  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60) + '\n');

  if (brokenLinks.length === 0) {
    console.log('✅ No broken links found!\n');
    process.exit(0);
  }

  console.log(`❌ Found ${brokenLinks.length} broken link(s)\n`);

  // Group by file for console output
  const byFile = new Map<string, BrokenLink[]>();
  brokenLinks.forEach(link => {
    if (!byFile.has(link.sourceFile)) {
      byFile.set(link.sourceFile, []);
    }
    byFile.get(link.sourceFile)!.push(link);
  });

  byFile.forEach((links, file) => {
    console.log(`📄 ${file} (${links.length} broken link(s)):`);
    links.forEach((link, index) => {
      console.log(`   ${index + 1}. "${link.linkText}" → ${link.href}`);
      console.log(`      ${link.reason}`);
    });
    console.log('');
  });

  // Save markdown report
  const reportPath = path.join(workspaceRoot, 'broken-links-report.md');
  const report = generateReport();
  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(`📝 Full report saved to: ${path.relative(workspaceRoot, reportPath)}\n`);

  // Exit with error code if broken links found
  process.exit(1);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
