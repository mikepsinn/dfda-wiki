#!/bin/bash
# Setup pre-commit hook for link validation

HOOK_FILE=".git/hooks/pre-commit"

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Pre-commit hook to validate links

# Get list of staged markdown files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.md$' || true)

if [ -z "$STAGED_FILES" ]; then
  # No markdown files staged, skip validation
  exit 0
fi

# Count staged markdown files
FILE_COUNT=$(echo "$STAGED_FILES" | wc -l | tr -d ' ')
echo "Validating links in $FILE_COUNT staged markdown file(s)..."

# Run validation on each staged file
FAILED=0
for file in $STAGED_FILES; do
  if ! npm run validate-links:file "$file" > /dev/null 2>&1; then
    echo "  ✗ $file"
    FAILED=1
  fi
done

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "❌ Link validation failed. Please fix broken links before committing."
  echo "   You can skip this check with: git commit --no-verify"
  exit 1
fi

echo "✅ Link validation passed"
exit 0
EOF

# Make hook executable
chmod +x "$HOOK_FILE"

echo "✅ Pre-commit hook installed successfully!"
echo "   The hook will validate links in staged markdown files before each commit."
