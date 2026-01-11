import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

interface ValidationResult {
  url: string;
  type: 'link' | 'image';
  status: 'ok' | 'broken' | 'timeout' | 'error';
  statusCode?: number;
  error?: string;
  file: string;
  line?: number;
}

const results: ValidationResult[] = [];
const checkedUrls = new Map<string, ValidationResult>(); // Cache to avoid checking same URL multiple times

async function checkUrl(url: string, type: 'link' | 'image'): Promise<ValidationResult['status']> {
  // Check cache first
  const cached = checkedUrls.get(url);
  if (cached) {
    return cached.status;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  try {
    // Try HEAD first (faster)
    const response = await fetch(url, { signal: controller.signal, headers, method: 'HEAD' });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Try GET if HEAD fails (some servers don't support HEAD)
      const getResponse = await fetch(url, { signal: controller.signal, headers });
      if (!getResponse.ok) {
        if (getResponse.status === 403) {
          // Some sites block bots - treat as warning
          return 'ok'; // Don't fail on 403
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
    
    const result: ValidationResult = {
      url,
      type,
      status: 'ok'
    };
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

function extractUrls(content: string): Array<{ url: string; type: 'link' | 'image'; line?: number }> {
  const urls: Array<{ url: string; type: 'link' | 'image'; line?: number }> = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const url = match[2];
      if (url.startsWith('http://') || url.startsWith('https://')) {
        urls.push({ url, type: 'link', line: index + 1 });
      }
    }

    // Markdown images: ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imageRegex.exec(line)) !== null) {
      const url = match[2];
      if (url.startsWith('http://') || url.startsWith('https://')) {
        urls.push({ url, type: 'image', line: index + 1 });
      }
    }

    // HTML images: <img src="url">
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/g;
    while ((match = htmlImageRegex.exec(line)) !== null) {
      const url = match[1];
      if (url.startsWith('http://') || url.startsWith('https://')) {
        urls.push({ url, type: 'image', line: index + 1 });
      }
    }
  });

  return urls;
}

async function validateFile(filePath: string): Promise<void> {
  const workspaceRoot = path.resolve(__dirname, '..');
  const fullPath = path.join(workspaceRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return;
  }

  const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
  const { content: markdownContent } = matter(fileContent);

  const urls = extractUrls(markdownContent);
  
  if (urls.length === 0) {
    return;
  }

  console.log(`Checking ${urls.length} URL(s) in ${filePath}...`);

  for (const { url, type, line } of urls) {
    const status = await checkUrl(url, type);
    const cached = checkedUrls.get(url)!;
    
    const result: ValidationResult = {
      ...cached,
      file: filePath,
      line
    };
    
    results.push(result);

    // Show progress for broken/timeout/error
    if (status !== 'ok') {
      const statusMsg = status === 'broken' 
        ? `Status ${cached.statusCode}` 
        : status === 'timeout' 
        ? 'Timeout' 
        : cached.error;
      console.log(`  ✗ ${type.toUpperCase()}: ${url} (${statusMsg})${line ? ` at line ${line}` : ''}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filePattern = args[0] || '**/*.md';
  const workspaceRoot = path.resolve(__dirname, '..');

  console.log(`Finding markdown files matching: ${filePattern}...`);
  
  const files = await glob(filePattern, {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**']
  });

  console.log(`Found ${files.length} file(s) to check.\n`);

  for (const file of files) {
    await validateFile(file);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));

  const broken = results.filter(r => r.status === 'broken');
  const timeouts = results.filter(r => r.status === 'timeout');
  const errors = results.filter(r => r.status === 'error');
  const ok = results.filter(r => r.status === 'ok');

  console.log(`Total URLs checked: ${results.length}`);
  console.log(`✓ OK: ${ok.length}`);
  console.log(`✗ Broken (404, etc.): ${broken.length}`);
  console.log(`⏱ Timeouts: ${timeouts.length}`);
  console.log(`⚠ Errors: ${errors.length}`);

  if (broken.length > 0) {
    console.log('\nBROKEN URLs:');
    broken.forEach(r => {
      console.log(`  [${r.type.toUpperCase()}] ${r.url} (Status: ${r.statusCode})`);
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
    const reportPath = path.join(workspaceRoot, 'broken-urls-report.md');
    const reportContent = generateMarkdownReport(broken, timeouts, errors, ok, results.length);
    
    await fs.promises.writeFile(reportPath, reportContent, 'utf-8');
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  // Exit with error code if there are broken links
  if (broken.length > 0 || timeouts.length > 0 || errors.length > 0) {
    process.exit(1);
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

  report.push('# Broken URLs Report');
  report.push('');
  report.push(`Generated: ${timestamp}`);
  report.push('');
  report.push('## Summary');
  report.push('');
  report.push(`- **Total URLs checked:** ${total}`);
  report.push(`- ✅ **OK:** ${ok.length}`);
  report.push(`- ❌ **Broken (404, etc.):** ${broken.length}`);
  report.push(`- ⏱️ **Timeouts:** ${timeouts.length}`);
  report.push(`- ⚠️ **Errors:** ${errors.length}`);
  report.push('');

  if (broken.length > 0) {
    report.push('## Broken URLs');
    report.push('');
    
    // Group by file
    const byFile = new Map<string, ValidationResult[]>();
    broken.forEach(r => {
      if (!byFile.has(r.file)) {
        byFile.set(r.file, []);
      }
      byFile.get(r.file)!.push(r);
    });

    byFile.forEach((results, file) => {
      report.push(`### ${file}`);
      report.push('');
      results.forEach(r => {
        report.push(`- **${r.type.toUpperCase()}** [${r.url}](${r.url}) - Status: ${r.statusCode}${r.line ? ` (line ${r.line})` : ''}`);
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

    byFile.forEach((results, file) => {
      report.push(`### ${file}`);
      report.push('');
      results.forEach(r => {
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

    byFile.forEach((results, file) => {
      report.push(`### ${file}`);
      report.push('');
      results.forEach(r => {
        report.push(`- **${r.type.toUpperCase()}** [${r.url}](${r.url}) - Error: ${r.error}${r.line ? ` (line ${r.line})` : ''}`);
      });
      report.push('');
    });
  }

  return report.join('\n');
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
