const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const path = require("path");

// Mermaid support - render as code blocks that get processed client-side
const mermaidPlugin = (md) => {
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() === 'mermaid') {
      return `<div class="mermaid">${token.content}</div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
};

module.exports = function(eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Markdown configuration with anchor and mermaid support
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
      // Skip mermaid - handled separately
      if (lang === 'mermaid') return str;
      // Add language class for Prism.js
      const langClass = lang ? `language-${lang}` : '';
      const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="${langClass}"><code class="${langClass}">${escaped}</code></pre>`;
    }
  })
  .use(markdownItAnchor, {
    slugify: s => s.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, ''),
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: 'after',
      class: 'anchor-link',
      symbol: '#'
    }),
    level: [2, 3, 4]
  })
  .use(mermaidPlugin);

  eleventyConfig.setLibrary("md", md);

  // Passthrough copy for assets (CSS is built separately by Tailwind CLI)
  eleventyConfig.addPassthroughCopy("assets");

  // Ignore patterns - don't process these as pages
  eleventyConfig.ignores.add("node_modules/**");
  eleventyConfig.ignores.add("scripts/**");
  eleventyConfig.ignores.add("_site/**");
  eleventyConfig.ignores.add(".git/**");
  eleventyConfig.ignores.add(".github/**");
  eleventyConfig.ignores.add(".cursor/**");
  eleventyConfig.ignores.add(".obsidian/**");
  eleventyConfig.ignores.add(".vscode/**");
  eleventyConfig.ignores.add("wiki/**");
  eleventyConfig.ignores.add("CLAUDE.md");
  eleventyConfig.ignores.add("FILE-ORGANIZATION.md");
  eleventyConfig.ignores.add("**/ROLE_TEMPLATE.md");
  eleventyConfig.ignores.add("**/templates/**");
  eleventyConfig.ignores.add("**/*_TEMPLATE*.md");
  eleventyConfig.ignores.add("**/README.md");

  // Domain directories for collections
  const domains = [
    'features',
    'benefits',
    'problems',
    'strategy',
    'regulatory',
    'economic-models',
    'community',
    'clinical-trials',
    'architecture',
    'proposals',
    'reference',
    'conditions',
    'interventions',
    'act',
    'careers',
    'treatments'
  ];

  // Create a collection for each domain directory
  domains.forEach(domain => {
    eleventyConfig.addCollection(domain, collection => {
      return collection.getFilteredByGlob(`${domain}/**/*.md`)
        .filter(item => item.data.published !== false)
        .sort((a, b) => {
          const titleA = (a.data.title || a.fileSlug || '').toLowerCase();
          const titleB = (b.data.title || b.fileSlug || '').toLowerCase();
          return titleA.localeCompare(titleB);
        });
    });
  });

  // All pages collection (for search indexing)
  eleventyConfig.addCollection("allPages", collection => {
    return collection.getFilteredByGlob("**/*.md")
      .filter(item => {
        // Exclude non-content files
        const excludePaths = ['node_modules', 'scripts', '_site', '.git', 'wiki', 'CLAUDE.md', 'FILE-ORGANIZATION.md'];
        return !excludePaths.some(p => item.inputPath.includes(p)) && item.data.published !== false;
      });
  });

  // Navigation collection - top-level directories
  eleventyConfig.addCollection("navigation", collection => {
    return domains.map(domain => ({
      title: domain.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      url: `/${domain}/`,
      key: domain
    }));
  });

  // Filters
  eleventyConfig.addFilter("sortByTitle", arr => {
    return [...arr].sort((a, b) => {
      const titleA = (a.data?.title || a.title || '').toLowerCase();
      const titleB = (b.data?.title || b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  });

  eleventyConfig.addFilter("limit", (arr, limit) => arr.slice(0, limit));

  eleventyConfig.addFilter("where", (arr, key, value) => {
    return arr.filter(item => {
      const data = item.data || item;
      return data[key] === value;
    });
  });

  // Format date filter
  eleventyConfig.addFilter("dateFormat", (date, format = "long") => {
    if (!date) return '';
    const d = new Date(date);
    if (format === "short") {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  });

  // ISO date for sitemap/feeds
  eleventyConfig.addFilter("date", (date, format) => {
    if (!date) return '';
    const d = new Date(date);
    if (format === "%Y-%m-%d") {
      return d.toISOString().split('T')[0];
    }
    if (format === "%a, %d %b %Y %H:%M:%S %z") {
      return d.toUTCString();
    }
    return d.toISOString();
  });

  // Reading time estimate
  eleventyConfig.addFilter("readingTime", content => {
    if (!content) return '1 min read';
    const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min read`;
  });

  // Get breadcrumbs from URL
  eleventyConfig.addFilter("breadcrumbs", url => {
    if (!url || url === '/') return [];

    const parts = url.split('/').filter(Boolean);
    const crumbs = [];
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath += `/${part}`;
      crumbs.push({
        title: part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        url: index === parts.length - 1 ? null : currentPath + '/',
        isLast: index === parts.length - 1
      });
    });

    return crumbs;
  });

  // Get directory from inputPath
  eleventyConfig.addFilter("getDirectory", inputPath => {
    const parts = inputPath.split(/[\/\\]/);
    // Find the first meaningful directory (skip . and root)
    for (const part of parts) {
      if (domains.includes(part)) {
        return part;
      }
    }
    return null;
  });

  // Extract table of contents from content
  eleventyConfig.addFilter("toc", content => {
    if (!content) return [];

    const headingRegex = /<h([2-4])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h\1>/gi;
    const toc = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      toc.push({
        level: parseInt(match[1]),
        id: match[2],
        text: match[3].replace(/#$/, '').trim()
      });
    }

    return toc;
  });

  // Fix relative markdown links to proper URLs
  eleventyConfig.addFilter("fixLinks", (content, inputPath) => {
    if (!content || !inputPath) return content;

    // Get the directory of the current file
    const currentDir = path.dirname(inputPath);

    // Replace markdown links with proper URLs
    return content.replace(
      /\[([^\]]+)\]\(([^)]+\.md)(#[^)]+)?\)/g,
      (match, text, href, anchor = '') => {
        // Skip external links
        if (href.startsWith('http://') || href.startsWith('https://')) {
          return match;
        }

        // Resolve the relative path
        let resolvedPath;
        if (href.startsWith('./') || href.startsWith('../')) {
          resolvedPath = path.join(currentDir, href);
        } else {
          resolvedPath = href;
        }

        // Convert to URL format
        let url = resolvedPath
          .replace(/\\/g, '/')
          .replace(/^\.\//, '/')
          .replace(/\.md$/, '/')
          .replace(/\/index\/$/, '/');

        // Ensure leading slash
        if (!url.startsWith('/')) {
          url = '/' + url;
        }

        return `[${text}](${url}${anchor})`;
      }
    );
  });

  // Get previous and next pages in same collection
  eleventyConfig.addFilter("getPrevNext", (collections, page, collectionName) => {
    if (!collections || !page || !collectionName) return { prev: null, next: null };

    const collection = collections[collectionName];
    if (!collection || !Array.isArray(collection)) return { prev: null, next: null };

    const currentIndex = collection.findIndex(item => item.url === page.url);
    if (currentIndex === -1) return { prev: null, next: null };

    return {
      prev: currentIndex > 0 ? collection[currentIndex - 1] : null,
      next: currentIndex < collection.length - 1 ? collection[currentIndex + 1] : null
    };
  });

  // Shortcodes
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Paired shortcode for callout boxes
  eleventyConfig.addPairedShortcode("callout", (content, type = "info") => {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      tip: '💡',
      danger: '🚨'
    };
    return `<div class="callout callout-${type}">
      <span class="callout-icon">${icons[type] || icons.info}</span>
      <div class="callout-content">${content}</div>
    </div>`;
  });

  // Transform: Strip .md extensions from links in final HTML
  eleventyConfig.addTransform("stripMdFromLinks", (content, outputPath) => {
    if (outputPath && outputPath.endsWith(".html")) {
      // Replace href="...file.md" with href="...file/"
      // Replace href="...file.md#anchor" with href="...file/#anchor"
      return content.replace(
        /href="([^"]*?)\.md(#[^"]*)?"/g,
        (match, path, anchor) => {
          return `href="${path}/${anchor || ''}"`;
        }
      );
    }
    return content;
  });

  // Watch targets for development
  eleventyConfig.addWatchTarget("./css/");
  eleventyConfig.addWatchTarget("./_includes/");
  eleventyConfig.addWatchTarget("./_layouts/");

  // Set default layout for all markdown files
  eleventyConfig.addGlobalData("layout", "page.njk");

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data"
    },
    markdownTemplateEngine: false,  // Disable Nunjucks in markdown to avoid conflicts with {{ }} in content
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"]  // Exclude HTML to avoid conflicts with existing wiki exports
  };
};
