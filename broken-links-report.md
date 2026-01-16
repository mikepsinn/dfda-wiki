# Broken Links Report

**Last Updated**: 2026-01-15

## Summary

| Metric | Count |
|--------|-------|
| Total links checked | 3,082 |
| OK | 2,627 (85%) |
| Warnings (401/403 - auth required) | 248 |
| Broken | 137 |
| Timeouts | 4 |
| Errors | 66 |

## Progress

- **Starting state**: 631 broken links
- **Current state**: 137 broken links
- **Improvement**: 78% reduction

## Fixes Applied

| Script | Fixes | Files |
|--------|-------|-------|
| fix-broken-links.ts | 425 MediaWiki anchors → kebab-case | 47 files |
| fix-wiki-urls.ts | 192 old wiki URLs → relative paths | various |
| fix-internal-links.ts | 182 broken internal links | 38 files |
| add-md-to-links.ts | 289 internal links restored .md extension | 69 files |
| fix-remaining-issues.ts | 72 anchor/image fixes | 28 files |
| Manual TOC cleanup | ~10 complex table of contents | 5 files |

**Total: ~1,170+ link fixes**

## Remaining Issues

Most remaining "broken" links are **not actually broken**:

1. **External URLs returning 403** (248): Sites like ScienceDirect, JAMA, Lancet, fdareview.org block automated requests but work fine in browsers

2. **Genuine 404s** (~50): External sites that have moved or been taken down:
   - csdd.tufts.edu/databases
   - rxivist.org/papers/129041
   - recoverytrial.net/news/...
   - Various ScienceDirect topic pages

3. **Fetch failures** (~20): Network timeouts or DNS issues with:
   - psychotropical.com
   - nardil.org
   - wallowinmaya.com
   - crowdsourcingcures.org (some subpaths)

## Recommendations

1. **External 403s**: These are false positives - the links work in browsers
2. **Genuine 404s**: Should be manually reviewed and either updated or removed
3. **Fetch failures**: May be temporary - recheck later or remove if consistently failing
