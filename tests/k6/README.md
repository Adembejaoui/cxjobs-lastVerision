# CXJobs Production K6 Load Test

Standalone K6 script for load testing the production CXJobs application as an already-authenticated candidate.

## Prerequisites

### Verify K6 Installation

```bash
k6 version
```

Expected output (version may vary):
```
k6 v0.54.0 (commit/..., go1.21.0, windows/amd64)
```

If not installed:
- Windows: `choco install k6` or download from https://k6.io/docs/getting-started/installation/
- macOS: `brew install k6`
- Linux: See https://k6.io/docs/getting-started/installation/

## Obtaining the Session Cookie

**Do not hard-code the session cookie.** Provide it via environment variable at runtime.

1. Open the production application in your browser: `https://cxjobs-last-verision.vercel.app`
2. Log in as an existing candidate who is already registered, onboarded, and authenticated
3. Open DevTools → Application → Cookies → `https://cxjobs-last-verision.vercel.app`
4. Copy the value of `__Secure-authjs.session-token`
   - If chunked (`.0`, `.1`, etc.), concatenate all chunks in order
5. Provide it when running K6:

```bash
k6 run -e K6_SESSION_COOKIE="YOUR_COOKIE_VALUE" tests/k6/production-authenticated-candidate.js
```

**Security notes:**
- Never commit the cookie to version control
- The cookie is only used in memory during the test run
- The script does not log the cookie value
- Use a dedicated test candidate account if possible

## Running the Test

### Basic Run (Production URL)

```bash
k6 run -e K6_SESSION_COOKIE="YOUR_SESSION_COOKIE" tests/k6/production-authenticated-candidate.js
```

### Custom Base URL (e.g., staging)

```bash
k6 run \
  -e K6_BASE_URL="https://staging.example.com" \
  -e K6_SESSION_COOKIE="YOUR_SESSION_COOKIE" \
  tests/k6/production-authenticated-candidate.js
```

### With JSON Output for CI/CD

```bash
k6 run \
  -e K6_SESSION_COOKIE="YOUR_SESSION_COOKIE" \
  --out json=results.json \
  tests/k6/production-authenticated-candidate.js
```

## Modifying Load Stages

Edit the `stages` array in `options.scenarios.candidate_browsing.stages` inside the test file:

```javascript
stages: [
  { duration: '1m', target: 10 },   // Ramp to 10 VUs over 1 minute
  { duration: '2m', target: 25 },   // Ramp to 25 VUs over 2 minutes
  { duration: '2m', target: 50 },   // Ramp to 50 VUs over 2 minutes
  { duration: '5m', target: 100 },  // Ramp to 100 VUs over 5 minutes
],
```

**Guidelines:**
- Start conservatively; this targets real production
- Do not jump to 300–500 VUs initially
- Each stage: `{ duration, target }` where target is VU count
- Total test duration ≈ 10 minutes + 30s graceful ramp-down

## Endpoints Tested

| Category | Endpoint | Method | Purpose |
|----------|----------|--------|---------|
| Auth | `/api/auth/session` | GET | Validate existing session |
| Pages | `/dashboard/candidate` | GET | Candidate dashboard page |
| Pages | `/dashboard/candidate/profile` | GET | Candidate profile page |
| Pages | `/dashboard/candidate/applications` | GET | Applications list page |
| Pages | `/jobs/[slug]` | GET | Job detail page |
| APIs | `/api/dashboard/candidate` | GET | Dashboard data |
| APIs | `/api/application` | GET | Applications list data |
| APIs | `/api/job-offers` | GET | Job offers list (source of slugs) |
| APIs | `/api/job-offers/by-slug/[slug]` | GET | Job detail data |

**Flow:**
1. Validate session → 2. Dashboard page → 3. Dashboard API → 4. Profile page → 5. Applications page → 6. Applications API → 7. Job offers list → 8. Extract slug → 9. Job detail page → 10. Job detail API → Repeat

## Why `/api/job-offers/[slug]/views` Is Excluded

The job detail page normally triggers `POST /api/job-offers/[slug]/views` to increment a view counter.

**This test intentionally does NOT call that endpoint** because:
- The test must remain strictly read-only
- Incrementing view counters on production would pollute analytics
- Multiple VUs sharing one session would artificially inflate views
- The goal is to test read performance, not write side effects

If you need to test the view counter, create a separate test with a dedicated test job.

## Understanding 429 Responses

The application enforces rate limits (~60 requests/minute/IP for job-list requests).

Since this test runs from a single machine, **all VUs share the same public IP**. At higher VU levels (50+), 429 responses are expected and **do not indicate application failure**.

The test tracks 429 separately:
- `rate_limit_429` counter: Total 429 responses
- `client_errors_4xx`: Other 4xx errors (400, 401, 403, 404, etc.)
- `server_errors_5xx`: Genuine server failures (500, 502, 503, 504)

**Interpretation:**
- High 429 at 100 VUs = expected rate limiting behavior
- High 5xx at any level = investigate application health
- High 401/403 = session expired or invalid cookie

## Interpreting Latency Metrics

| Metric | Meaning | Target (Production) |
|--------|---------|---------------------|
| **avg** | Mean latency | < 500ms |
| **med (p50)** | Median latency | < 400ms |
| **p90** | 90th percentile | < 1000ms |
| **p95** | 95th percentile | < 2000ms |
| **p99** | 99th percentile | < 5000ms |
| **max** | Maximum observed | < 10000ms |

**Thresholds in test:**
- `p(95) < 2000ms` — 95% of requests under 2s
- `p(99) < 5000ms` — 99% of requests under 5s
- Adjust based on your SLA

**P95 vs P99:**
- P95 = typical worst-case experience for most users
- P99 = outlier experience; investigate if P99 >> P95

## Stopping the Test Safely

- **Ctrl+C** once: Graceful shutdown (waits for in-flight requests, runs `handleSummary`)
- **Ctrl+C** twice: Force kill (immediate, may lose summary)
- The test includes `gracefulRampDown: '30s'` for clean VU termination

## Important Limitations & Risks

| Limitation | Impact |
|------------|--------|
| **Single shared session cookie** | All VUs appear as ONE user. Tests infrastructure/application under concurrent load from one identity, NOT realistic multi-user simulation. |
| **Rate limiting from single IP** | 429s at higher VUs are network/rate-limit artifacts, not app capacity limits. |
| **Read-only only** | Does not test write paths (applications, messages, profile updates, file uploads). |
| **Production target** | Test runs against live production. Monitor error rates; stop if 5xx spikes. |
| **Session expiry** | NextAuth JWT sessions last 30 days. Ensure cookie is fresh before long runs. |
| **No think time variation** | Fixed `sleep()` intervals; real users have more variance. |

## Output Metrics Summary

At test completion, a JSON summary prints to stdout with:

```json
{
  "test": "CXJobs Production Authenticated Candidate Load Test",
  "timestamp": "2026-09-23T...",
  "baseUrl": "https://cxjobs-last-verision.vercel.app",
  "stages": [...],
  "metrics": {
    "totalRequests": 12345,
    "successfulRequests": 11800,
    "httpFailures": 545,
    "rateLimit429": 400,
    "clientErrors4xx": 100,
    "serverErrors5xx": 45,
    "avgLatencyMs": 342.5,
    "medianLatencyMs": 280,
    "p90LatencyMs": 850,
    "p95LatencyMs": "1850.25",
    "p99LatencyMs": 4200,
    "maxLatencyMs": 8900,
    "requestsPerSecond": 20.5,
    "checksPassed": 11500,
    "checksFailed": 300,
    "authFailureRate": 0
  },
  "notes": [...]
}
```

## Quick Checklist Before Running

- [ ] K6 installed and in PATH
- [ ] Valid session cookie from authenticated candidate
- [ ] Cookie not expired (NextAuth 30-day JWT)
- [ ] Candidate has existing profile, applications, and visible jobs
- [ ] You accept this targets **production**
- [ ] You have monitoring/alerting visible during test
- [ ] You can stop the test within 30 seconds if needed

---

**Reminder:** This test targets the real production application. Run responsibly.