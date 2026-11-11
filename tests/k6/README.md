# CXJobs k6 load tests (staging only)

> **Never load-test production.** Every script here refuses to start unless
> `K6_BASE_URL` names a **staging, preview or local** deployment, and known
> production hosts are always refused. There is deliberately no override
> (guard: `tests/k6/lib/target-guard.mjs`).

Despite their historical `production-*` file names, these scripts are meant
for an isolated staging/preview environment, with test accounts and
non-production data.

## Accepted targets

| Accepted | Example |
|---|---|
| Local | `http://localhost:3000`, `http://127.0.0.1:3000`, `*.local` |
| Host containing a `staging` / `preview` label | `https://cxjobs-staging.vercel.app`, `https://staging.cxjobs.app` |
| Vercel branch preview | `https://cxjobs-git-my-branch-team.vercel.app` |
| Exact host listed in `K6_ALLOWED_HOSTS` (comma-separated) | `-e K6_ALLOWED_HOSTS=perf.example.com` |

**Always refused:**
- `cxjobs-last-verision.vercel.app`, `cxjobs.app`, `www.cxjobs.app`;
- any host added via `K6_PRODUCTION_HOSTS`;
- a missing `K6_BASE_URL`;
- any other host.

## Prerequisites

1. A staging/preview deployment with its **own** database, Redis, storage and OAuth credentials. Never production secrets.
2. Seeded **test** accounts on that deployment.
3. k6 installed (`k6 version`).

## Obtaining session cookies (staging test accounts only)

- Generate them with the Node helpers, which apply the same guard. For example:

  ```bash
  K6_BASE_URL=https://cxjobs-staging.vercel.app node tests/k6/generate-candidate-sessions.js
  ```

- Or sign in to the **staging** site as a test user and copy `__Secure-authjs.session-token` (or `authjs.session-token` over http). If it's chunked (`.0`, `.1`, …), concatenate the chunks in order.

Never use a cookie from a real user or from production. Cookie files (`.k6-*-cookies.txt`) are gitignored; delete them after use.

## Running

```bash
k6 run \
  -e K6_BASE_URL="https://cxjobs-staging.vercel.app" \
  -e K6_SESSION_COOKIE="STAGING_TEST_SESSION_COOKIE" \
  tests/k6/production-authenticated-candidate.js
```

To keep results, add `--out json=results.json`. The output file is gitignored.

In CI, use the **manual** `k6 Load Testing` workflow (`workflow_dispatch`). It also refuses non-staging targets before k6 starts.

## Load shape

Edit `stages` in `options.scenarios.candidate_browsing` (default 10 → 25 → 50 → 100 VUs, about 10 minutes). Start low (10–25 VUs) and watch:
- staging DB connections;
- Vercel function concurrency;
- the Upstash command budget.

Suggested thresholds: p95 < 800 ms on `/api/job-offers`, error rate < 1%.

## Endpoints exercised (read-only)

| Category | Endpoint | Method |
|---|---|---|
| Auth | `/api/auth/session` | GET |
| Pages | `/dashboard/candidate`, `/dashboard/candidate/profile`, `/dashboard/candidate/applications`, `/jobs/[slug]` | GET |
| APIs | `/api/dashboard/candidate`, `/api/application`, `/api/job-offers`, `/api/job-offers/by-slug/[slug]` | GET |

`POST /api/job-offers/[jobId]/views` is intentionally **not** called. The tests stay read-only, and view counts are deduplicated per visitor anyway.

## 429 responses

The app rate-limits per IP (for example 60 job-list requests per minute) and per account. A single load generator therefore hits 429s that reflect rate limiting, not capacity. Treat sustained 429s as expected, and look at the latency and 5xx rates of the successful requests.

## Limitations

| Limitation | Impact |
|---|---|
| Single shared session cookie (`production-authenticated-candidate.js`) | All VUs act as ONE user. Use `production-multi-user-candidates.js` with generated cookies for multi-user load. |
| Single source IP | Per-IP rate limits cap throughput. |
| Read-only | Write paths (applications, uploads, profile edits) are not exercised. |
| Session expiry | JWT sessions last 30 days; refresh cookies before long runs. |

## Stopping safely

Press Ctrl+C once for a graceful stop (in-flight requests finish and the summary prints). Press it twice to force-stop.

## Checklist

- [ ] `K6_BASE_URL` points at **staging/preview/local**. The guard refuses anything else.
- [ ] Staging uses its own DB, Redis, storage and OAuth app, with no production secrets.
- [ ] Only test accounts and test cookies are used.
- [ ] Monitoring for the staging environment is open during the run.
- [ ] You can stop within 30 seconds.
