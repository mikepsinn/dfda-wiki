const fs = require('fs');

const content = fs.readFileSync('broken-links-report.md', 'utf8');
const lines = content.split('\n');

// Find file sections
let currentFile = null;
const fileIssues = {};

lines.forEach((line, idx) => {
  // Detect file headers - format is "### filename.md"
  if (line.startsWith('###') && !line.includes('File:')) {
    currentFile = line.replace('###', '').trim();
    if (!fileIssues[currentFile]) {
      fileIssues[currentFile] = [];
    }
  } else if (line.includes('Broken section link') && currentFile) {
    // Format: - **INTERNAL** `#anchor` - Broken section link: #anchor. Possible headings are: heading1, heading2... (line N)
    const linkMatch = line.match(/`([^`]+)`/);
    const anchorMatch = line.match(/Broken section link[^:]*: ([^.]+)\./);
    const headingsMatch = line.match(/Possible headings[^:]*: ([^(]+)/);
    const lineMatch = line.match(/\(line (\d+)\)/);

    if (linkMatch && anchorMatch) {
      fileIssues[currentFile].push({
        link: linkMatch[1],
        brokenAnchor: anchorMatch[1].trim(),
        possibleHeadings: headingsMatch ? headingsMatch[1].trim().split(', ') : [],
        lineInfo: lineMatch ? lineMatch[1] : 'unknown'
      });
    }
  }
});

// Output detailed report
let totalIssues = 0;
const filesWithIssues = [];

Object.keys(fileIssues).forEach(file => {
  if (fileIssues[file].length > 0) {
    totalIssues += fileIssues[file].length;
    filesWithIssues.push({ file, issues: fileIssues[file] });
  }
});

console.log('Total files with broken section links:', filesWithIssues.length);
console.log('Total broken section links:', totalIssues);
console.log('\n=== TOP 15 FILES WITH MOST ISSUES ===\n');

filesWithIssues
  .sort((a, b) => b.issues.length - a.issues.length)
  .slice(0, 15)
  .forEach(({ file, issues }) => {
    console.log(`\n${file} (${issues.length} issues)`);
    issues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. Line ${issue.lineInfo}: ${issue.brokenAnchor}`);
      console.log(`     Link: ${issue.link}`);
      if (issue.possibleHeadings.length > 0) {
        console.log(`     Possible matches: ${issue.possibleHeadings.slice(0, 5).join(', ')}${issue.possibleHeadings.length > 5 ? '...' : ''}`);
      }
    });
  });
