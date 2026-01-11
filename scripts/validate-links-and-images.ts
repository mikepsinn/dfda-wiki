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
  file: string;
  line?: number;
}

const results: ValidationResult[] = [];
const checkedUrls = new Map<string, ValidationResult>(); // Cache for external URLs
const workspaceRoot = path.resolve(__dirname, '..');

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
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const { content: markdownContent } = matter(content);
  
  const headings: string[] = [];

  const md = markdownit().use(anchor, {
    level: [1, 2, 3, 4, 5, 6],
    slugify: (s) => s.trim().toLowerCase().replace(/[\s+]/g, '-').replace(/[.,()]/g, ''),
    callback: (token, { slug }) => {
      headings.push(decodeURIComponent(slug));
    }
  });

  md.render(markdownContent);
  
  return headings;
}

async function checkExternalUrl(url: string, type: 'link' | 'image'): Promise<ValidationResult['status']> {
  // Check cache first
  const cached = checkedUrls.get(url);
  if (cached) {
    return cached.status;
  }

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
        if (getResponse.status === 403) {
          // Some sites block bots - treat as ok
          const result: ValidationResult = { url, type, status: 'ok' };
          checkedUrls.set(url, result);
          return 'ok';
        }
        const result: ValidationResult = {
          url,
          type,
          status: 'broken',
          statusCode: getResponse.status
        };
        checkedUrls.set(url, result);
        return 'broken';
      }
    }
    
    const result: ValidationResult = { url, type, status: 'ok' };
    checkedUrls.set(url, result);
    return 'ok';
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
      return 'timeout';
    }
    
    const result: ValidationResult = {
      url,
      type,
      status: 'error',
      error: error.message
    };
    checkedUrls.set(url, result);
    return 'error';
  }
}

async function validateInternalLink(link: string, sourceFile: string, allHeadings: Set<string>): Promise<string | null> {
  try {
    if (link.startsWith('#')) {
      // Section link in the same file
      const anchor = link.substring(1);
      if (!allHeadings.has(anchor)) {
        return `Broken section link: ${link}. Possible headings are: ${Array.from(allHeadings).join(', ')}`;
      }
    } else {
      // Internal file path
      const [filePath, anchor] = link.split('#');
      const absolutePath = path.resolve(path.dirname(path.join(workspaceRoot, sourceFile)), filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return `Broken internal link: ${link} (File not found at ${absolutePath})`;
      }

      if (anchor) {
        const targetHeadings = await getHeadings(absolutePath);
        if (!targetHeadings.includes(anchor)) {
          return `Broken section link in different file: ${link} (Section #${anchor} not found in ${filePath}. Possible headings: ${targetHeadings.join(', ')})`;
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
  });

  return items;
}

async function validateFile(filePath: string, fixAmpersandsFlag: boolean = false): Promise<void> {
  const fullPath = path.join(workspaceRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return;
  }

  if (fixAmpersandsFlag) {
    await fixAmpersands(filePath);
  }

  const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
  const { content: markdownContent } = matter(fileContent);

  const items = extractLinksAndImages(markdownContent);
  const sourceHeadings = await getHeadings(fullPath);
  const sourceHeadingsSet = new Set(sourceHeadings);

  if (items.length === 0) {
    return;
  }

  console.log(`Validating ${items.length} link(s)/image(s) in ${filePath}...`);

  for (const { url, type, line } of items) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // External URL
      const status = await checkExternalUrl(url, type);
      const cached = checkedUrls.get(url)!;
      
      const result: ValidationResult = {
        ...cached,
        file: filePath,
        line
      };
      
      results.push(result);

      if (status !== 'ok') {
        const statusMsg = status === 'broken' 
          ? `Status ${cached.statusCode}` 
          : status === 'timeout' 
          ? 'Timeout' 
          : cached.error;
        console.log(`  ✗ ${type.toUpperCase()}: ${url} (${statusMsg})${line ? ` at line ${line}` : ''}`);
      }
    } else {
      // Internal link
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
    }
  }
}

function generateMarkdownReport(
  broken: ValidationResult[],
  timeouts: ValidationResult[],
  errors: ValidationResult[],
  ok: ValidationResult[],
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
      if (!byFile.has(r.file)) {
        byFile.set(r.file, []);
      }
      byFile.get(r.file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        if (r.type === 'internal') {
          report.push(`- **INTERNAL** \`${r.url}\` - ${r.error}${r.line ? ` (line ${r.line})` : ''}`);
        } else {
          report.push(`- **${r.type.toUpperCase()}** [${r.url}](${r.url})${r.statusCode ? ` - Status: ${r.statusCode}` : ''}${r.line ? ` (line ${r.line})` : ''}`);
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
      if (!byFile.has(r.file)) {
        byFile.set(r.file, []);
      }
      byFile.get(r.file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        report.push(`- **${r.type.toUpperCase()}** [${r.url}](${r.url})${r.line ? ` (line ${r.line})` : ''}`);
      });
      report.push('');
    });
  }

  if (errors.length > 0) {
    report.push('## Error URLs');
    report.push('');
    
    const byFile = new Map<string, ValidationResult[]>();
    errors.forEach(r => {
      if (!byFile.has(r.file)) {
        byFile.set(r.file, []);
      }
      byFile.get(r.file)!.push(r);
    });

    byFile.forEach((fileResults, file) => {
      report.push(`### ${file}`);
      report.push('');
      fileResults.forEach(r => {
        report.push(`- **${r.type.toUpperCase()}** [${r.url}](${r.url}) - Error: ${r.error}${r.line ? ` (line ${r.line})` : ''}`);
      });
      report.push('');
    });
  }

  return report.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const fixAmpersandsFlag = args.includes('--fix-ampersands');
  const filePattern = args.find(arg => !arg.startsWith('--')) || '**/*.md';

  console.log(`Finding markdown files matching: ${filePattern}...`);
  
  const files = await glob(filePattern, {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**']
  });

  console.log(`Found ${files.length} file(s) to check.\n`);

  for (const file of files) {
    await validateFile(file, fixAmpersandsFlag);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));

  const broken = results.filter(r => r.status === 'broken');
  const timeouts = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');
  const ok = results.filter(r => r.status === 'ok');

  console.log(`Total links/images checked: ${results.length}`);
  console.log(`✓ OK: ${ok.length}`);
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
  if (broken.length > 0 || timeouts.length > 0 || errors.length > 0) {
    const reportPath = path.join(workspaceRoot, 'broken-links-report.md');
    const reportContent = generateMarkdownReport(broken, timeouts, errors, ok, results.length);
    
    await fs.promises.writeFile(reportPath, reportContent, 'utf-8');
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  // Exit with error code if there are broken links
  if (broken.length > 0 || timeouts.length > 0 || errors.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
