import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import markdownit from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { glob } from 'glob';

interface ValidationResult {
  url: string;
  type: 'link' | 'image' | 'internal';
  status: 'ok' | 'broken' | 'timeout' | 'error';
  statusCode?: number;
  error?: string;
  file?: string; // Optional for cached results
  line?: number;
}

interface CacheEntry {
  status: ValidationResult['status'];
  statusCode?: number;
  error?: string;
  timestamp: number;
}

const results: ValidationResult[] = [];
const checkedUrls = new Map<string, ValidationResult>(); // Runtime cache for external URLs
let cacheHits = 0;
let freshChecks = 0;
const workspaceRoot = path.resolve(__dirname, '..');
const cacheFilePath = path.join(workspaceRoot, '.link-cache.json');
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Files to skip validation (documentation/examples with placeholder links, or report files)
const SKIP_VALIDATION_FILES = [
  'CLAUDE.md',
  'FILE-ORGANIZATION.md',
  'community/CONTRIBUTING.md',
  'BROKEN_INTERNAL_LINKS.md',
  'broken-links-report.md',
  'broken-urls-report.md',
  'validation-results.txt'
];

let linkCache: Map<string, CacheEntry> = new Map();

// Find similar headings to suggest (simple substring/prefix matching)
function findSimilarHeadings(target: string, headings: string[] | Set<string>, maxResults: number = 3): string[] {
  const headingArray = Array.isArray(headings) ? headings : Array.from(headings);
  const targetLower = target.toLowerCase();
  
  // Score headings by similarity
  const scored = headingArray.map(h => {
    const hLower = h.toLowerCase();
    let score = 0;
    
    // Exact match
    if (hLower === targetLower) score = 100;
    // Starts with target
    else if (hLower.startsWith(targetLower)) score = 80;
    // Target starts with heading
    else if (targetLower.startsWith(hLower)) score = 70;
    // Contains target
    else if (hLower.includes(targetLower)) score = 60;
    // Target contains heading
    else if (targetLower.includes(hLower)) score = 50;
    // Share common prefix (at least 3 chars)
    else {
      let commonPrefix = 0;
      for (let i = 0; i < Math.min(hLower.length, targetLower.length); i++) {
        if (hLower[i] === targetLower[i]) commonPrefix++;
        else break;
      }
      if (commonPrefix >= 3) score = commonPrefix * 2;
    }
    
    return { heading: h, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.heading);
}

// Load cache from file
function loadCache(): void {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
      const now = Date.now();
      for (const [url, entry] of Object.entries(cacheData)) {
        const cacheEntry = entry as CacheEntry;
        // Only load entries that haven't expired
        if (now - cacheEntry.timestamp < CACHE_TTL) {
          linkCache.set(url, cacheEntry);
        }
      }
    }
  } catch (error) {
    // If cache file is corrupted, start fresh
    console.warn('Warning: Could not load link cache, starting fresh');
  }
}

// Save cache to file
function saveCache(): void {
  try {
    const cacheData: Record<string, CacheEntry> = {};
    linkCache.forEach((entry, url) => {
      cacheData[url] = entry;
    });
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Warning: Could not save link cache');
  }
}

// Optional: Fix ampersands in headings and links
async function fixAmpersands(filePath: string): Promise<void> {
  const fullPath = path.join(workspaceRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    return;
  }

  let content = await fs.promises.readFile(fullPath, 'utf-8');
  const originalContent = content;

  // 1. Fix headings
  content = content.split('\n').map(line => {
    if (line.trim().startsWith('#')) {
      return line.replace(/ & /g, ' and ').replace(/R&D/g, 'R and D');
    }
    return line;
  }).join('\n');

  // 2. Fix link text and corresponding anchor slugs
  content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    let newText = text;
    let newUrl = url;
    let textChanged = false;
    let urlChanged = false;

    // Fix link text for consistency
    if (newText.includes(' & ') || newText.includes('R&D')) {
        newText = newText.replace(/ & /g, ' and ').replace(/R&D/g, 'R and D');
        textChanged = true;
    }

    // Fix link anchor slug if it's an internal link
    if (newUrl.startsWith('#')) {
        if (newUrl.includes('-&-')) {
            newUrl = newUrl.replace(/-&-/g, '-and-');
            urlChanged = true;
        }
        if (newUrl.includes('r&d')) {
            newUrl = newUrl.replace(/r&d/g, 'r-and-d');
            urlChanged = true;
        }
    }
    
    if (textChanged || urlChanged) {
        return `[${newText}](${newUrl})`;
    }
    
    return match;
  });

  if (content !== originalContent) {
    console.log(`Fixed ampersands in ${filePath}`);
    await fs.promises.writeFile(fullPath, content, 'utf-8');
  }
}

async function getHeadings(filePath: string): Promise<string[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const { content: markdownContent } = matter(content);
    
    const headings: string[] = [];

    const md = markdownit().use(anchor, {
      level: [1, 2, 3, 4, 5, 6],
      slugify: (s) => {
        try {
          return s.trim().toLowerCase().replace(/[\s+]/g, '-').replace(/[.,()]/g, '');
        } catch (e) {
          return s.trim().toLowerCase().replace(/[\s+]/g, '-');
        }
      },
      callback: (token, { slug }) => {
        try {
          headings.push(decodeURIComponent(slug));
        } catch (e) {
          // If URI is malformed, just use the slug as-is
          headings.push(slug);
        }
      }
    });

    try {
      md.render(markdownContent);
    } catch (e) {
      // If markdown rendering fails, return empty headings
      console.warn(`Warning: Failed to parse markdown in ${filePath}: ${e}`);
      return [];
    }
    
    // Also extract HTML anchor IDs: <a id="..."> or <a name="...">
    const htmlAnchorRegex = /<a\s+(?:[^>]*?\s+)?(?:id|name)=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = htmlAnchorRegex.exec(markdownContent)) !== null) {
      headings.push(match[1]);
    }
    
    return headings;
  } catch (error: any) {
    console.warn(`Warning: Failed to get headings from ${filePath}: ${error.message}`);
    return [];
  }
}

async function checkExternalUrl(url: string, type: 'link' | 'image'): Promise<{ status: ValidationResult['status']; isWarning?: boolean }> {
  // Check runtime cache first
  const runtimeCached = checkedUrls.get(url);
  if (runtimeCached) {
    cacheHits++;
    return { status: runtimeCached.status, isWarning: runtimeCached.statusCode === 401 || runtimeCached.statusCode === 403 };
  }

  // Check persistent cache
  const cached = linkCache.get(url);
  if (cached) {
    const now = Date.now();
    if (now - cached.timestamp < CACHE_TTL) {
      // Cache is still valid
      cacheHits++;
      const result: ValidationResult = {
        url,
        type,
        status: cached.status,
        statusCode: cached.statusCode,
        error: cached.error
      };
      checkedUrls.set(url, result);
      return { status: cached.status, isWarning: cached.statusCode === 401 || cached.statusCode === 403 };
    } else {
      // Cache expired, remove it
      linkCache.delete(url);
    }
  }
  
  freshChecks++;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  try {
    const response = await fetch(url, { signal: controller.signal, headers, method: 'HEAD' });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const getResponse = await fetch(url, { signal: controller.signal, headers });
      if (!getResponse.ok) {
        // 401 and 403 are often auth/bot protection - treat as warnings, not errors
        if (getResponse.status === 401 || getResponse.status === 403) {
          const result: ValidationResult = { 
            url, 
            type, 
            status: 'ok', // Mark as ok but we'll log it as a warning
            statusCode: getResponse.status
          };
          checkedUrls.set(url, result);
          // Save to persistent cache
          linkCache.set(url, {
            status: 'ok',
            statusCode: getResponse.status,
            timestamp: Date.now()
          });
          return { status: 'ok', isWarning: true };
        }
        const result: ValidationResult = {
          url,
          type,
          status: 'broken',
          statusCode: getResponse.status
        };
        checkedUrls.set(url, result);
        // Save to persistent cache
        linkCache.set(url, {
          status: 'broken',
          statusCode: getResponse.status,
          timestamp: Date.now()
        });
        return { status: 'broken' };
      }
    }
    
    const result: ValidationResult = { url, type, status: 'ok' };
    checkedUrls.set(url, result);
    // Save to persistent cache
    linkCache.set(url, {
      status: 'ok',
      timestamp: Date.now()
    });
    return { status: 'ok' };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      const result: ValidationResult = {
        url,
        type,
        status: 'timeout',
        error: 'Request timed out after 15 seconds'
      };
      checkedUrls.set(url, result);
      // Don't cache timeouts - they might be temporary
      return { status: 'timeout' };
    }
    
    const result: ValidationResult = {
      url,
      type,
      status: 'error',
      error: error.message
    };
    checkedUrls.set(url, result);
    // Don't cache errors - they might be temporary
    return { status: 'error' };
  }
}

// Static asset extensions that should be checked for actual file existence
const STATIC_ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.css', '.js', '.xml', '.json', '.pdf', '.woff', '.woff2', '.ttf', '.eot'];

// Build-time generated paths that don't exist in source but will exist after build
const BUILD_TIME_PATHS = [
  '/css/styles.css',
  '/_pagefind/',
  '/feed.xml',
  '/sitemap.xml',
];

async function validateInternalLink(link: string, sourceFile: string, allHeadings: Set<string>): Promise<string | null> {
  try {
    // Skip build-time generated paths
    for (const buildPath of BUILD_TIME_PATHS) {
      if (link.startsWith(buildPath) || link === buildPath) {
        return null; // Valid - will be generated at build time
      }
    }

    // Check if this is a static asset (has known extension)
    const ext = path.extname(link).toLowerCase();
    if (STATIC_ASSET_EXTENSIONS.includes(ext)) {
      // For static assets, check if the actual file exists
      let assetPath = link;
      if (link.startsWith('/')) {
        assetPath = link.slice(1); // Remove leading /
      } else {
        // Relative path
        assetPath = path.resolve(path.dirname(path.join(workspaceRoot, sourceFile)), link);
        assetPath = path.relative(workspaceRoot, assetPath).replace(/\\/g, '/');
      }
      const fullAssetPath = path.join(workspaceRoot, assetPath);
      if (fs.existsSync(fullAssetPath)) {
        return null; // File exists
      }
      return `Broken asset link: ${link} (File not found at ${assetPath})`;
    }

    if (link.startsWith('#')) {
      // Section link in the same file
      const anchor = link.substring(1);
      if (!allHeadings.has(anchor)) {
        const similar = findSimilarHeadings(anchor, allHeadings);
        const suggestion = similar.length > 0 
          ? `Did you mean: ${similar.join(', ')}?` 
          : '(no similar headings found)';
        return `Broken anchor: ${link} - ${suggestion}`;
      }
    } else {
      // Handle root-relative URLs (starting with /)
      let filePath = link;
      let anchor: string | undefined;
      
      if (link.startsWith('/') && !link.startsWith('//')) {
        // Root-relative URL like /strategy/ or /features/data-import.md
        filePath = link.slice(1); // Remove leading /
        const hashIndex = filePath.indexOf('#');
        if (hashIndex !== -1) {
          anchor = filePath.substring(hashIndex + 1);
          filePath = filePath.substring(0, hashIndex);
        }
        
        // Remove trailing slash
        filePath = filePath.replace(/\/$/, '') || 'home';
        
        // Try to find the file
        if (!filePath.endsWith('.md')) {
          const possiblePaths = [
            `${filePath}/index.md`,
            `${filePath}.md`,
            `${filePath}/README.md`
          ];
          let found = false;
          for (const possiblePath of possiblePaths) {
            const fullPossiblePath = path.join(workspaceRoot, possiblePath);
            if (fs.existsSync(fullPossiblePath)) {
              filePath = possiblePath;
              found = true;
              break;
            }
          }
          if (!found) {
            // Check if it's a directory that exists
            const dirPath = path.join(workspaceRoot, filePath);
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
              // Directory exists, treat as valid (will be handled by 11ty)
              return null;
            }
            return `Broken internal link: ${link} (File not found. Tried: ${filePath}/index.md, ${filePath}.md, ${filePath}/README.md)`;
          }
        }
      } else {
        // Relative path
        const hashIndex = filePath.indexOf('#');
        if (hashIndex !== -1) {
          anchor = filePath.substring(hashIndex + 1);
          filePath = filePath.substring(0, hashIndex);
        }
        filePath = path.resolve(path.dirname(path.join(workspaceRoot, sourceFile)), filePath);
        filePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
      }
      
      const absolutePath = path.join(workspaceRoot, filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return `Broken internal link: ${link} (File not found at ${absolutePath})`;
      }

      if (anchor) {
        const targetHeadings = await getHeadings(absolutePath);
        if (!targetHeadings.includes(anchor)) {
          const similar = findSimilarHeadings(anchor, targetHeadings);
          const suggestion = similar.length > 0 
            ? `Did you mean: ${similar.join(', ')}?` 
            : '(no similar headings found)';
          return `Broken anchor in ${filePath}: #${anchor} - ${suggestion}`;
        }
      }
    }
  } catch (error: any) {
    return `Error validating internal link ${link}: ${error.message}`;
  }
  
  return null;
}

function extractLinksAndImages(content: string): Array<{ url: string; type: 'link' | 'image'; line?: number }> {
  const items: Array<{ url: string; type: 'link' | 'image'; line?: number }> = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const url = match[2];
      items.push({ url, type: 'link', line: index + 1 });
    }

    // Markdown images: ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imageRegex.exec(line)) !== null) {
      const url = match[2];
      items.push({ url, type: 'image', line: index + 1 });
    }

    // HTML images: <img src="url">
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/g;
    while ((match = htmlImageRegex.exec(line)) !== null) {
      const url = match[1];
      items.push({ url, type: 'image', line: index + 1 });
    }

    // HTML/Nunjucks links: href="url" or href="{{ item.url }}"
    const hrefRegex = /href=["']([^"']+)["']/g;
    while ((match = hrefRegex.exec(line)) !== null) {
      const url = match[1];
      // Skip template variables like {{ item.url }}
      if (!url.includes('{{') && !url.includes('{%')) {
        items.push({ url, type: 'link', line: index + 1 });
      }
    }
  });

  return items;
}

function extractUrlsFromJson(jsonContent: string, filePath: string): Array<{ url: string; type: 'link' | 'image'; line?: number }> {
  const items: Array<{ url: string; type: 'link' | 'image'; line?: number }> = [];
  
  try {
    const data = JSON.parse(jsonContent);
    
    function traverse(obj: any, path: string = '') {
      // Skip redirect configs - they contain patterns, not actual links
      if (path.includes('redirects') || path.includes('rewrites')) {
        return;
      }
      
      if (typeof obj === 'string') {
        // Only extract URLs that look like actual links (not redirect patterns with :path* or regex)
        if ((obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('/')) 
            && !obj.includes(':path') && !obj.includes('(.*)') && !obj.includes('*')) {
          items.push({ url: obj, type: 'link' });
        }
      } else if (typeof obj === 'object' && obj !== null) {
        // Look for 'url' property specifically (navigation structure)
        if (obj.url && typeof obj.url === 'string') {
          // Skip redirect patterns
          if (!obj.url.includes(':path') && !obj.url.includes('(.*)') && !obj.url.includes('*')) {
            items.push({ url: obj.url, type: 'link' });
          }
        }
        for (const key in obj) {
          traverse(obj[key], path ? `${path}.${key}` : key);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          traverse(item, `${path}[${index}]`);
        });
      }
    }
    
    traverse(data);
  } catch (error) {
    console.warn(`Warning: Failed to parse JSON in ${filePath}: ${error}`);
  }
  
  return items;
}

async function validateFile(filePath: string, fixAmpersandsFlag: boolean = false): Promise<void> {
  // Skip validation for documentation files with example links
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (SKIP_VALIDATION_FILES.some(skipFile => normalizedPath.endsWith(skipFile) || normalizedPath === skipFile)) {
    console.log(`⏭ Skipping validation: ${filePath} (documentation file)`);
    return;
  }

  const fullPath = path.join(workspaceRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return;
  }

  if (fixAmpersandsFlag && filePath.endsWith('.md')) {
    await fixAmpersands(filePath);
  }

  const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
  
  let items: Array<{ url: string; type: 'link' | 'image'; line?: number }> = [];
  let sourceHeadings: string[] = [];
  let sourceHeadingsSet: Set<string> = new Set();

  // Handle different file types
  if (filePath.endsWith('.json')) {
    // JSON files (like navigation.json)
    items = extractUrlsFromJson(fileContent, filePath);
  } else if (filePath.endsWith('.njk') || filePath.endsWith('.html')) {
    // Template files (header, footer, etc.)
    items = extractLinksAndImages(fileContent);
  } else if (filePath.endsWith('.md')) {
    // Markdown files
    const { content: markdownContent } = matter(fileContent);
    items = extractLinksAndImages(markdownContent);
    sourceHeadings = await getHeadings(fullPath);
    sourceHeadingsSet = new Set(sourceHeadings);
  } else {
    // Other files - try to extract links anyway
    items = extractLinksAndImages(fileContent);
  }

  if (items.length === 0) {
    return;
  }

  // Only log file header if we find issues (reduces noise)
  let fileHeaderLogged = false;
  const logFileHeader = () => {
    if (!fileHeaderLogged) {
      console.log(`\n📄 ${filePath} (${items.length} links):`);
      fileHeaderLogged = true;
    }
  };

  // URLs that are preconnect hints or CDN roots (not actual pages)
  const SKIP_EXTERNAL_URLS = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdn.jsdelivr.net',
  ];

  for (const { url, type, line } of items) {
    try {
      // Skip mailto:, tel:, and other non-http protocols
      if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('sms:')) {
        // These are valid protocol links, skip validation
        const result: ValidationResult = {
          url,
          type: 'link',
          status: 'ok',
          file: filePath,
          line
        };
        results.push(result);
        continue;
      }

      // Skip preconnect hints and CDN roots that return 404 when fetched directly
      if (SKIP_EXTERNAL_URLS.some(skipUrl => url === skipUrl || url.startsWith(skipUrl + '/'))) {
        const result: ValidationResult = {
          url,
          type: 'link',
          status: 'ok',
          file: filePath,
          line
        };
        results.push(result);
        continue;
      }

      if (url.startsWith('http://') || url.startsWith('https://')) {
        // External URL
        const { status, isWarning } = await checkExternalUrl(url, type);
        const cached = checkedUrls.get(url)!;

        const result: ValidationResult = {
          ...cached,
          file: filePath,
          line
        };

        results.push(result);

        if (isWarning) {
          logFileHeader();
          console.log(`  ⚠ ${type.toUpperCase()}: ${url} (Status ${cached.statusCode} - may require authentication)${line ? ` at line ${line}` : ''}`);
        } else if (status !== 'ok') {
          logFileHeader();
          const statusMsg = status === 'broken'
            ? `Status ${cached.statusCode}`
            : status === 'timeout'
            ? 'Timeout'
            : cached.error;
          console.log(`  ✗ ${type.toUpperCase()}: ${url} (${statusMsg})${line ? ` at line ${line}` : ''}`);
        }
      } else {
        // Internal link
        try {
          const error = await validateInternalLink(url, filePath, sourceHeadingsSet);
          if (error) {
            const result: ValidationResult = {
              url,
              type: 'internal',
              status: 'broken',
              error,
              file: filePath,
              line
            };
            results.push(result);
            logFileHeader();
            console.log(`  ✗ INTERNAL: ${url} - ${error}${line ? ` at line ${line}` : ''}`);
          } else {
            const result: ValidationResult = {
              url,
              type: 'internal',
              status: 'ok',
              file: filePath,
              line
            };
            results.push(result);
          }
        } catch (error: any) {
          logFileHeader();
          console.warn(`  ⚠ Warning: Failed to validate internal link ${url}: ${error.message}`);
        }
      }
    } catch (error: any) {
      logFileHeader();
      console.warn(`  ⚠ Warning: Error processing ${type} ${url}${line ? ` at line ${line}` : ''}: ${error.message}`);
    }
  }
}

function generateMarkdownReport(
  broken: ValidationResult[],
  timeouts: ValidationResult[],
  errors: ValidationResult[],
  ok: ValidationResult[],
  warnings: ValidationResult[],
  total: number
): string {
  const timestamp = new Date().toISOString();
  const report: string[] = [];

  report.push('# Link Validation Report');
  report.push('');
  report.push(`Generated: ${timestamp}`);
  report.push('');
  report.push('## Summary');
  report.push('');
  report.push(`- **Total links/images checked:** ${total}`);
  report.push(`- ✅ **OK:** ${ok.length}`);
  if (warnings.length > 0) {
    report.push(`- ⚠️ **Warnings (401/403):** ${warnings.length}`);
  }
  report.push(`- ❌ **Broken:** ${broken.length}`);
  report.push(`- ⏱️ **Timeouts:** ${timeouts.length}`);
  report.push(`- ⚠️ **Errors:** ${errors.length}`);
  report.push('');

  if (broken.length > 0) {
    report.push('## Broken Links/Images');
    report.push('');
    
    // Group by file
    const byFile = new Map<string, ValidationResult[]>();
    broken.forEach(r => {
      const file = r.file || 'unknown';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        if (r.type === 'internal') {
          report.push(`- [ ] **INTERNAL** \`${r.url}\` - ${r.error}${r.line ? ` (line ${r.line})` : ''}`);
        } else {
          report.push(`- [ ] **${r.type.toUpperCase()}** [${r.url}](${r.url})${r.statusCode ? ` - Status: ${r.statusCode}` : ''}${r.line ? ` (line ${r.line})` : ''}`);
        }
      });
      report.push('');
    });
  }

  if (timeouts.length > 0) {
    report.push('## Timeout URLs');
    report.push('');

    const byFile = new Map<string, ValidationResult[]>();
    timeouts.forEach(r => {
      const file = r.file || 'unknown';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        report.push(`- [ ] **${r.type.toUpperCase()}** [${r.url}](${r.url})${r.line ? ` (line ${r.line})` : ''}`);
      });
      report.push('');
    });
  }

  if (warnings.length > 0) {
    report.push('## Warning URLs (401/403 - May require authentication)');
    report.push('');

    const byFile = new Map<string, ValidationResult[]>();
    warnings.forEach(r => {
      const file = r.file || 'unknown';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        report.push(`- [ ] **${r.type.toUpperCase()}** [${r.url}](${r.url}) - Status: ${r.statusCode}${r.line ? ` (line ${r.line})` : ''}`);
      });
      report.push('');
    });
  }

  if (errors.length > 0) {
    report.push('## Error URLs');
    report.push('');

    const byFile = new Map<string, ValidationResult[]>();
    errors.forEach(r => {
      const file = r.file || 'unknown';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        report.push(`- [ ] **${r.type.toUpperCase()}** [${r.url}](${r.url}) - Error: ${r.error}${r.line ? ` (line ${r.line})` : ''}`);
      });
      report.push('');
    });
  }

  return report.join('\n');
}

async function main() {
  // Load cache at startup
  loadCache();
  
  const args = process.argv.slice(2);
  const fixAmpersandsFlag = args.includes('--fix-ampersands');
  const skipCache = args.includes('--skip-cache');
  
  // Get all non-flag arguments as file paths or patterns
  const fileArgs = args.filter(arg => !arg.startsWith('--'));

  if (skipCache) {
    linkCache.clear();
    console.log('Cache cleared (--skip-cache flag used)');
  } else {
    console.log(`Loaded ${linkCache.size} cached URL result(s)`);
  }

  let files: string[] = [];
  
  if (fileArgs.length === 0) {
    // No files specified - use default pattern for all files
    console.log('Finding all markdown, JSON, and template files...');
    const defaultPattern = '{**/*.md,**/*.json,_includes/**/*.njk,_data/**/*.json}';
    files = await glob(defaultPattern, {
      cwd: workspaceRoot,
      ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**']
    });
  } else if (fileArgs.length === 1 && fileArgs[0].includes('*')) {
    // Single glob pattern
    console.log(`Finding files matching: ${fileArgs[0]}...`);
    files = await glob(fileArgs[0], {
      cwd: workspaceRoot,
      ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**']
    });
  } else {
    // Multiple specific files passed as arguments
    console.log(`Validating ${fileArgs.length} specific file(s)...`);
    files = fileArgs;
  }
  
  // Skip config files that contain redirect patterns, not actual links
  const configFiles = ['vercel.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.js', 'tailwind.config.js'];
  files = files.filter(file => !configFiles.some(config => file.includes(config)));

  console.log(`Found ${files.length} file(s) to check.\n`);

  for (const file of files) {
    try {
      await validateFile(file, fixAmpersandsFlag);
    } catch (error: any) {
      console.error(`Error validating file ${file}: ${error.message}`);
      // Continue with other files instead of crashing
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));

  // Filter out 401/403 warnings from broken count
  const broken = results.filter(r => r.status === 'broken');
  const warnings = results.filter(r => r.status === 'ok' && (r.statusCode === 401 || r.statusCode === 403));
  const timeouts = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');
  const ok = results.filter(r => r.status === 'ok' && r.statusCode !== 401 && r.statusCode !== 403);

  console.log(`Total links/images checked: ${results.length}`);
  console.log(`  External URLs: ${cacheHits + freshChecks} (${cacheHits} cached, ${freshChecks} fresh)`);
  console.log(`✓ OK: ${ok.length}`);
  if (warnings.length > 0) {
    console.log(`⚠ Warnings (401/403 - may require auth): ${warnings.length}`);
  }
  console.log(`✗ Broken: ${broken.length}`);
  console.log(`⏱ Timeouts: ${timeouts.length}`);
  console.log(`⚠ Errors: ${errors.length}`);

  if (broken.length > 0) {
    console.log('\nBROKEN:');
    broken.forEach(r => {
      if (r.type === 'internal') {
        console.log(`  [INTERNAL] ${r.url} - ${r.error}`);
      } else {
        console.log(`  [${r.type.toUpperCase()}] ${r.url}${r.statusCode ? ` (Status: ${r.statusCode})` : ''}`);
      }
      console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ''}`);
    });
  }

  if (timeouts.length > 0) {
    console.log('\nTIMEOUT URLs:');
    timeouts.forEach(r => {
      console.log(`  [${r.type.toUpperCase()}] ${r.url}`);
      console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ''}`);
    });
  }

  if (errors.length > 0) {
    console.log('\nERROR URLs:');
    errors.forEach(r => {
      console.log(`  [${r.type.toUpperCase()}] ${r.url}`);
      console.log(`    Error: ${r.error}`);
      console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ''}`);
    });
  }

  // Generate markdown report
  if (broken.length > 0 || timeouts.length > 0 || errors.length > 0 || warnings.length > 0) {
    const reportPath = path.join(workspaceRoot, 'broken-links-report.md');
    const reportContent = generateMarkdownReport(broken, timeouts, errors, ok, warnings, results.length);
    
    await fs.promises.writeFile(reportPath, reportContent, 'utf-8');
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  if (warnings.length > 0) {
    console.log('\nWARNING URLs (401/403 - may require authentication):');
    warnings.forEach(r => {
      console.log(`  [${r.type.toUpperCase()}] ${r.url} (Status: ${r.statusCode})`);
      console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ''}`);
    });
  }

  // Save cache before exiting
  saveCache();

  // Exit with error code only for actual broken links (404s)
  // Timeouts and fetch errors are often transient or false positives (bot blocking)
  // 401/403 warnings are not failures - those URLs usually work in browsers
  if (broken.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
