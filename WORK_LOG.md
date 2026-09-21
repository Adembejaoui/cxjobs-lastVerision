# WORK_LOG.md

## 2026-09-09 — Phase 0: Preserve the Dirty Tree

### Issue IDs
- PRESERVE-01

### Files changed
- `PERFORMANCE_AUDIT.md` — deleted
- `load-test.js` — deleted
- `package.json` — modified
- `package-lock.json` — modified
- `prisma/run-seed.js` — deleted
- `prisma/seed.ts` — major rewrite
- `typescript_errors.txt` — deleted
- `app/(public)/page.tsx` — modified
- `app/(public)/companies/CompaniesPageClient.tsx` — modified
- `app/(public)/companies/components/CompanyCard.tsx` — modified
- `app/(public)/jobs/JobsPageClient.tsx` — modified
- `app/(public)/jobs/[slug]/apply/page.tsx` — modified
- `app/(public)/jobs/[slug]/job-detail-client.tsx` — modified
- `app/(dashboard)/dashboard/candidate/page.tsx` — modified
- `app/(dashboard)/dashboard/candidate/profile/page.tsx` — modified
- `app/(dashboard)/dashboard/candidate/alerts/page.tsx` — deleted
- `app/(dashboard)/dashboard/company/profile/page.tsx` — modified
- `components/featured-job-banner.tsx` — modified
- `components/header.tsx` — modified
- `components/landing/trusted-strip.tsx` — modified
- `components/navbar.tsx` — modified
- `components/ui/form-field.tsx` — modified
- `components/ui/select.tsx` — modified
- `components/ui/sheet.tsx` — modified
- `components/ui/sidebar.tsx` — modified

### Changes
- Recorded git status, tracked diffs, staged diffs, and untracked non-ignored files
- Created binary preservation patch at `../cxjobs-dirty.diff`
- Stashed with untracked non-ignored files: `preserve-before-production-hardening-20260909`
- Created branch `hardening/production-readiness` from `main`
- Reapplied stash successfully with no conflicts
- Verified all 26 dirty files are present in intended state
- `git diff --check` passes with no whitespace errors

### Decisions and tradeoffs
- Used `git stash push --include-untracked` to preserve all modifications and deletions
- Created binary patch outside repo for additional safety
- Did not commit or discard the stash before branch verification
- Preserved the deleted alerts page as intentional (per plan contradiction note)

### Security decisions
- No secrets stashed or committed (`.env` files remain ignored)

### Database changes
- None

### Tests and commands
- `git status --porcelain=v1 -z`: completed
- `git diff --binary > ../cxjobs-dirty.diff`: completed
- `git diff --cached --binary >> ../cxjobs-dirty.diff`: completed
- `git ls-files --others --exclude-standard`: completed (no untracked non-ignored files)
- `git stash push --include-untracked -m "preserve-before-production-hardening-20260909"`: completed
- `git switch -c hardening/production-readiness`: completed
- `git stash pop`: completed (no conflicts)
- `git status --short`: verified all 26 files
- `git diff --check`: passed

### Remaining risks
- None for this phase