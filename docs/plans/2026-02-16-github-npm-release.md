# GitHub & npm Release Plan

**Date:** 2026-02-16  
**Status:** Ready to Execute  
**Goal:** Push secondbrain-cli to GitHub and publish to npm registry

---

## Release Information

- **GitHub Account:** novis10813
- **Repository Name:** secondbrain-cli
- **Package Name:** secondbrain-cli
- **Current Version:** 0.1.0
- **npm Scope:** None (public package)

---

## Task 1: Prepare GitHub Repository

**Files:**
- Update: `package.json` (add repository info)
- Check: `README.md`
- Check: `.gitignore`

**Step 1: Update package.json with GitHub repository URL**

Add to package.json:

```json
{
  ...
  "repository": {
    "type": "git",
    "url": "https://github.com/novis10813/secondbrain-cli.git"
  },
  "bugs": {
    "url": "https://github.com/novis10813/secondbrain-cli/issues"
  },
  "homepage": "https://github.com/novis10813/secondbrain-cli#readme"
}
```

**Step 2: Verify .gitignore is proper**

Check that it excludes:
- node_modules/
- dist/
- *.log
- test-upsert.db
- test-results.xml
- .env

**Step 3: Verify README.md is complete**

Check for:
- Project description
- Installation instructions
- Usage examples
- License section

**Step 4: Create GitHub repository**

Via GitHub web interface:
1. Go to https://github.com/new
2. Repository name: `secondbrain-cli`
3. Description: "A CLI tool for LLM agents to interact with Obsidian vaults"
4. Visibility: Public
5. Do NOT initialize with README (already have one)
6. Create repository

**Step 5: Connect local repo to GitHub**

```bash
git remote add origin https://github.com/novis10813/secondbrain-cli.git
git branch -M main
git push -u origin main
```

**Step 6: Create initial release tag**

```bash
git tag -a v0.1.0 -m "Initial release: Performance optimizations and batch link loading"
git push origin v0.1.0
```

---

## Task 2: Prepare npm Publishing

**Files:**
- Verify: `package.json` (all fields correct)
- Check: `dist/` directory built

**Step 1: Verify package.json is npm-ready**

Required fields:
- ✅ name: "secondbrain-cli"
- ✅ version: "0.1.0"
- ✅ description: Present and clear
- ✅ main: "dist/index.js"
- ✅ bin: Has "sb" and "secondbrain" commands
- ✅ keywords: Present
- ✅ license: "MIT"
- ✅ author: Should add your info
- ✅ engines: node >= 18.0.0
- ✅ repository: URL to GitHub (from Task 1)

**Step 2: Update author in package.json**

```json
{
  "author": "novis10813",
  ...
}
```

**Step 3: Build distribution**

```bash
npm run build
# or
bun run build
```

**Step 4: Verify dist/ is properly built**

Check that dist/ contains:
- index.js
- All compiled .js files
- Proper directory structure

**Step 5: Create .npmignore (optional)**

If npm publish includes too many files, create `.npmignore`:

```
src/
tests/
docs/
.git/
.gitignore
tsconfig.json
bun.lock
test-results.xml
test-upsert.db
tests_vault/
.ralph/
PRD.md
```

---

## Task 3: Publish to npm

**Step 1: Authenticate with npm**

```bash
npm login
# or if using Bun package registry
bun pm login
```

This will prompt for:
- npm username
- password
- email (optional)
- OTP if 2FA enabled

**Step 2: Dry run - check what will be published**

```bash
npm publish --dry-run
```

Review output to ensure only necessary files are included.

**Step 3: Publish to npm**

```bash
npm publish
```

Expected output:
```
npm WARN ...
npm notice <package details>
npm notice Publishing to https://registry.npmjs.org/
npm notice
+ secondbrain-cli@0.1.0
```

**Step 4: Verify published package**

Check on npm:
- Visit: https://www.npmjs.com/package/secondbrain-cli
- Verify version 0.1.0 is listed
- Check homepage links to GitHub

**Step 5: Test installation**

```bash
npm install -g secondbrain-cli
# or
bun install -g secondbrain-cli

# Test command
secondbrain --version
```

---

## Task 4: Create Release on GitHub

**Step 1: Create GitHub Release**

Via GitHub web interface:
1. Go to: https://github.com/novis10813/secondbrain-cli/releases
2. Click "Draft a new release"
3. Tag version: v0.1.0 (should exist already)
4. Release title: "v0.1.0 - Initial Release"
5. Release notes:

```markdown
# v0.1.0 - Initial Release

## Major Features
- CLI tool for interacting with Obsidian vaults
- LLM agent integration
- Markdown knowledge management

## Performance Optimizations (This Release)
- **N+1 Query Fix**: Reduced database queries from 1+2N to 3 for bulk operations
- **Link Churn Reduction**: Eliminated unnecessary delete/insert cycles
- **Batch Link Loading**: SQL JOIN aggregation for efficient link resolution

## Installation

```bash
npm install -g secondbrain-cli
```

## Usage

```bash
secondbrain --help
sb <vault-path> <command> [options]
```

## Testing
- 76 unit and performance tests passing
- Full test coverage for performance optimizations

## License
MIT
```

6. Mark as latest release
7. Publish release

---

## Verification Checklist

- [ ] GitHub repository created and accessible
- [ ] Local repo connected to GitHub with `git remote`
- [ ] All commits pushed to main branch
- [ ] Release tag v0.1.0 created and pushed
- [ ] package.json updated with repository URL and author
- [ ] dist/ built and verified
- [ ] npm account authenticated
- [ ] Dry run completed successfully
- [ ] Published to npm successfully
- [ ] Package visible on npmjs.com
- [ ] Installation test passed
- [ ] GitHub release created with notes

---

## Rollback Plan

If something goes wrong:

1. **npm unpublish** (within 72 hours):
   ```bash
   npm unpublish secondbrain-cli@0.1.0
   ```

2. **Delete GitHub release**:
   - Go to releases page
   - Delete the release
   - Delete the tag: `git push origin --delete v0.1.0`

3. **Fix and re-release** with same or new version

---

## Notes

- Current version in package.json is 0.1.0
- All tests pass (76/76)
- Code is production-ready per reviews
- Performance optimizations are verified
- MIT license is appropriate for this project
