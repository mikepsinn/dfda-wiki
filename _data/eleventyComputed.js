const { execSync } = require('child_process');
const path = require('path');

// Get last modified date from git
function getGitLastModified(filePath) {
  try {
    const result = execSync(
      `git log -1 --format="%aI" -- "${filePath}"`,
      { encoding: 'utf8', cwd: process.cwd() }
    ).trim();
    return result || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  // Compute git last modified date
  lastModified: data => {
    if (!data.page || !data.page.inputPath) return null;
    const gitDate = getGitLastModified(data.page.inputPath);
    return gitDate ? new Date(gitDate) : null;
  },

  // Set default layout based on directory
  layout: data => {
    // Home page uses home layout
    if (data.page.inputPath === './home.md') {
      return 'home.njk';
    }

    // Use layout from frontmatter if specified
    if (data.layout && data.layout !== 'page.njk') {
      return data.layout;
    }

    // Default to page layout
    return 'page.njk';
  },

  // Compute permalink to remove .html extension
  permalink: data => {
    // Skip files that have published: false
    if (data.published === false) {
      return false;
    }

    // Skip files that already have a permalink
    if (data.permalink) {
      return data.permalink;
    }

    // Handle home page
    if (data.page.inputPath === './home.md') {
      return '/';
    }

    // Generate clean URLs
    const slug = data.page.fileSlug;
    const dir = data.page.filePathStem.replace(`/${slug}`, '');

    // If it's an index file, use the directory path
    if (slug === 'index' || slug === 'README') {
      return `${dir}/`;
    }

    return `${dir}/${slug}/`;
  },

  // Compute title from frontmatter or filename
  eleventyNavigation: data => {
    if (!data.title) return undefined;

    return {
      key: data.page.fileSlug,
      title: data.title,
      parent: data.parent || null
    };
  }
};
