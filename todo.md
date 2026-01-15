# Content Reorganization Todo

## 1. Create New Top-Level Directories

- [ ] Create `/about/` directory for overview content
- [ ] Create `/platform/` directory (rename from `features/` for clarity)

---

## 2. Root Level Cleanup

Move scattered root files into `/about/`:

- [ ] Move `problem.md` → `about/problem.md`
  - [ ] Add redirect: `/problem/` → `/about/problem/`
- [ ] Move `solution.md` → `about/solution.md`
  - [ ] Add redirect: `/solution/` → `/about/solution/`
- [ ] Move `logical-proof.md` → `about/logical-proof.md`
  - [ ] Add redirect: `/logical-proof/` → `/about/logical-proof/`
- [ ] Move `one-pager.md` → `about/one-pager.md`
  - [ ] Add redirect: `/one-pager/` → `/about/one-pager/`
- [ ] Move `specification.md` → `about/specification.md`
  - [ ] Add redirect: `/specification/` → `/about/specification/`
- [ ] Move `architecture.md` → `about/architecture.md`
  - [ ] Add redirect: `/architecture/` → `/about/architecture/`

Resolve act.md vs act/ conflict:

- [ ] Move `act.md` → `act/index.md` (or merge content)
  - [ ] Update any links pointing to `/act.md`

---

## 3. Rename `features/` → `platform/`

- [ ] Rename directory `features/` → `platform/`
- [ ] Add redirect: `/features/*` → `/platform/*`
- [ ] Update all internal links from `/features/` to `/platform/`

Reorganize platform/ into subcategories:

- [ ] Create `platform/data-collection/` subcategory
  - [ ] Move `data-collection.md` → `platform/data-collection/index.md`
  - [ ] Move `data-collection-plugins.md` → `platform/data-collection/plugins.md`
  - [ ] Move `data-import.md` → `platform/data-collection/import.md`
  - [ ] Move `data-silo-api-gateways.md` → `platform/data-collection/api-gateways.md`

- [ ] Create `platform/analysis/` subcategory
  - [ ] Move `data-analysis.md` → `platform/analysis/index.md`
  - [ ] Move `analytics/` contents → `platform/analysis/`
  - [ ] Move `root-cause-analysis-plugin.md` → `platform/analysis/root-cause-analysis.md`
  - [ ] Move `root-cause-analysis-reports.md` → `platform/analysis/reports.md`
  - [ ] Move `predictor-search-engine.md` → `platform/analysis/predictor-search.md`
  - [ ] Move `observational-studies.md` → `platform/analysis/observational-studies.md`

- [ ] Create `platform/output/` subcategory (user-facing features)
  - [ ] Move `outcome-labels.md` → `platform/output/outcome-labels.md`
  - [ ] Move `outcome-labels-plugin.md` → `platform/output/outcome-labels-plugin.md`
  - [ ] Move `decision-support-notifications.md` → `platform/output/notifications.md`
  - [ ] Move `notifications.md` → merge with above or delete if duplicate

- [ ] Create `platform/agents/` subcategory
  - [ ] Move `fdai/` → `platform/agents/fdai/`
  - [ ] Move `optomitron-ai-agent.md` → `platform/agents/optomitron.md`
  - [ ] Move `global-health-unifier-agent.md` → `platform/agents/global-health-unifier.md`
  - [ ] Move `study-review-agent.md` → `platform/agents/study-review.md`

- [ ] Create `platform/infrastructure/` subcategory
  - [ ] Move `digital-twin-safe.md` → `platform/infrastructure/digital-twin-safe.md`
  - [ ] Move `digital-twin-skeleton-key-nft.md` → `platform/infrastructure/skeleton-key-nft.md`
  - [ ] Move `life-force-score-nft.md` → `platform/infrastructure/life-force-nft.md`
  - [ ] Move `human-file-system-protocol.md` → `platform/infrastructure/file-system-protocol.md`
  - [ ] Move `desci-exchange.md` → `platform/infrastructure/desci-exchange.md`
  - [ ] Move `treasury/` → `platform/infrastructure/treasury/`

- [ ] Keep at platform/ root level:
  - [ ] `browser-extension/`
  - [ ] `clinipedia/`
  - [ ] `api/`
  - [ ] `no-code-app-builder.md`
  - [ ] `informed-consent-quiz.md`
  - [ ] `personal-fda-nodes.md`
  - [ ] `dfda-roadmap.md`

---

## 4. Merge Duplicate/Redundant Content

Problems directory duplicates:

- [ ] Merge `problems/clinical-research-is-expensive.md` and `problems/clinical-research-is-too-expensive.md`
  - [ ] Keep better one, redirect other
- [ ] Review `problems/unpatentable-treatments.md` vs `problems/no-data-on-unpatentable-molecules.md`
- [ ] Review `problems/unrepresentative-participants.md` vs `problems/trials-often-arent-representative-of-real-patients.md`

Wiki directory (legacy):

- [ ] Move `wiki/interventions/` contents → `interventions/`
  - [ ] Add redirects for any moved files
- [ ] Move `wiki/open-source/` contents → `community/open-source/`
  - [ ] Add redirects for any moved files
- [ ] Delete empty `wiki/` directory
- [ ] Add redirect: `/wiki/*` → appropriate new locations

---

## 5. Merge `reference-databases/` into `reference/`

- [ ] Move `reference-databases/` → `reference/databases/`
- [ ] Add redirect: `/reference-databases/*` → `/reference/databases/*`
- [ ] Update `reference-databases/README.md` permalink

---

## 6. Flatten Deep Nesting in `reference/`

Current: `reference/cost-barriers/barriers-to-trials/regulatory-barriers/`

- [ ] Flatten to: `reference/cost-barriers/regulatory-barriers/`
  - [ ] Move all files up one level
  - [ ] Add redirects for old paths
- [ ] Consider flattening `cost-barriers/` entirely into `reference/`
  - [ ] `reference/cost-barriers-overview.md`
  - [ ] `reference/cost-barriers-analysis.md`
  - [ ] etc.

---

## 7. Delete Empty Directories

- [ ] Delete `legal/` (0 files) or add placeholder content
- [ ] Delete empty subdirs in `community/`:
  - [ ] Check and delete if empty: `daos/`
  - [ ] Check and delete if empty: `developers/`
  - [ ] Check and delete if empty: `funding_sources/`
  - [ ] Check and delete if empty: `healthcare_providers/`
  - [ ] Check and delete if empty: `patient_advocacy/`
  - [ ] Check and delete if empty: `researchers/`
  - [ ] Check and delete if empty: `volunteers/`
- [ ] Delete empty feature subdirs that have corresponding .md files:
  - [ ] `features/data-analysis/` (if empty)
  - [ ] `features/data-collection/` (if empty)
  - [ ] `features/data-import/` (if empty)
  - [ ] `features/outcome-labels/` (if empty)

---

## 8. Standardize Naming Conventions

Rename underscore dirs to hyphens:

- [ ] Rename `community/funding_sources/` → `community/funding-sources/`
  - [ ] Add redirect
- [ ] Rename `community/healthcare_providers/` → `community/healthcare-providers/`
  - [ ] Add redirect
- [ ] Rename `community/patient_advocacy/` → `community/patient-advocacy/`
  - [ ] Add redirect

---

## 9. Handle `conditions/` Directory

Only 2 files - decide fate:

- [ ] Option A: Merge into `interventions/` or `reference/`
- [ ] Option B: Keep and populate with more condition-specific content
- [ ] If merging, add redirects

---

## 10. Update Vercel Redirects

Add all redirects to `vercel.json`:

```json
{
  "redirects": [
    { "source": "/problem/", "destination": "/about/problem/", "permanent": true },
    { "source": "/solution/", "destination": "/about/solution/", "permanent": true },
    { "source": "/logical-proof/", "destination": "/about/logical-proof/", "permanent": true },
    { "source": "/one-pager/", "destination": "/about/one-pager/", "permanent": true },
    { "source": "/specification/", "destination": "/about/specification/", "permanent": true },
    { "source": "/architecture/", "destination": "/about/architecture/", "permanent": true },
    { "source": "/features/:path*", "destination": "/platform/:path*", "permanent": true },
    { "source": "/wiki/:path*", "destination": "/:path*", "permanent": true },
    { "source": "/reference-databases/:path*", "destination": "/reference/databases/:path*", "permanent": true }
  ]
}
```

- [ ] Add redirects to vercel.json
- [ ] Test redirects after deployment

---

## 11. Update Internal Links

After reorganization:

- [ ] Run `npm run validate-links` to find broken internal links
- [ ] Fix all broken links in source markdown files
- [ ] Run `npm run build:validate` to verify

---

## 12. Update Navigation & Config

- [ ] Update `section-indexes.njk` with new sections (`about`, `platform`)
- [ ] Update `.eleventy.js` domains array
- [ ] Update `CLAUDE.md` with new structure documentation
- [ ] Update site navigation/header if applicable

---

## 13. Final Verification

- [ ] Run full build: `npm run build`
- [ ] Run link validation: `npm run validate:built`
- [ ] Verify all redirects work
- [ ] Check search index includes new locations
- [ ] Review sitemap

---

## Proposed New Structure

```
dfda-wiki/
├── about/                    # Overview & summary content
│   ├── problem.md
│   ├── solution.md
│   ├── logical-proof.md
│   ├── one-pager.md
│   ├── specification.md
│   └── architecture.md
│
├── act/                      # Legislation
│   └── index.md             # (merged from act.md)
│
├── benefits/                 # ✓ Keep as-is
├── careers/                  # ✓ Keep as-is
├── clinical-trials/          # ✓ Keep as-is
│
├── community/                # Cleaned up
│   ├── businesses/
│   ├── nonprofits/
│   ├── partners/
│   ├── templates/
│   └── open-source/         # (from wiki/)
│
├── economic-models/          # ✓ Keep as-is
├── interventions/            # (merged wiki/interventions)
│
├── platform/                 # Renamed from features/
│   ├── data-collection/
│   ├── analysis/
│   ├── output/
│   ├── agents/
│   ├── infrastructure/
│   ├── browser-extension/
│   ├── clinipedia/
│   └── api/
│
├── problems/                 # Deduplicated
│   └── statistics/
│
├── proposals/                # ✓ Keep as-is
│
├── reference/                # Flattened
│   ├── databases/           # (from reference-databases/)
│   ├── cost-barriers/       # Flattened
│   └── ...
│
├── regulatory/               # ✓ Keep as-is
│   └── recommendations/
│
├── strategy/                 # ✓ Keep as-is
│   ├── 1-percent-treaty/
│   └── referendum/
│
└── home.md                   # Keep at root
```
