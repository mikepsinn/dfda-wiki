# Validate and Fix Links

Run the link validation script and fix any broken links or images found.

## Instructions

1. Run the validation script:
   ```bash
   npx tsx scripts/validate-links-and-images.ts
   ```

2. Review the output and the generated `broken-links-report.md` file if created.

3. For each broken link or image found:
   - **External URLs (404, timeouts, errors)**:
     - Search the web to find the correct/updated URL
     - If the resource has moved, update to the new URL
     - If the resource no longer exists, find an archive.org wayback machine link or an alternative source
     - If no alternative exists, consider removing the link or noting it as unavailable

   - **Broken internal links**:
     - Check if the target file was renamed or moved
     - Use glob/grep to find the correct file path
     - Update the link to point to the correct location

   - **Broken section anchors**:
     - Check the target file for the actual heading slugs
     - Update the anchor to match the correct heading slug

   - **Broken images**:
     - Search for the image by filename in the repository
     - If external, search for alternative image sources
     - Update the image path/URL accordingly

4. After making fixes, re-run the validation script to verify all issues are resolved.

5. Summarize what was fixed and any remaining issues that couldn't be automatically resolved.

## Optional Arguments

- `$ARGUMENTS` - Pass additional arguments to the script (e.g., specific file pattern like `strategy/*.md`)

If arguments are provided, run:
```bash
npx tsx scripts/validate-links-and-images.ts $ARGUMENTS
```
