import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.K6_BASE_URL || 'https://cxjobs-last-verision.vercel.app';
const SESSION_COOKIE = __ENV.K6_SESSION_COOKIE;

if (!SESSION_COOKIE) {
  throw new Error('K6_SESSION_COOKIE environment variable is required. Provide an existing NextAuth session cookie.');
}

const sessionCookieHeader = ` __Secure-authjs.session-token=${SESSION_COOKIE}`;

const defaultHeaders = {
  'Accept': 'application/json, text/html, */*',
  'User-Agent': 'k6-load-test/1.0 (CXJobs production read-only)',
};

const latencyTrend = new Trend('request_latency', true);
const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');
const httpFailures = new Counter('http_failures');
const rateLimitResponses = new Counter('rate_limit_429');
const clientErrors = new Counter('client_errors_4xx');
const serverErrors = new Counter('server_errors_5xx');
const authFailures = new Rate('auth_failures');

const DEFAULT_STAGES = [
  { duration: '1m', target: 10 },
  { duration: '2m', target: 25 },
  { duration: '2m', target: 50 },
  { duration: '5m', target: 100 },
];

export const options = {
  scenarios: {
    candidate_browsing: {
      executor: 'ramping-vus',
      stages: DEFAULT_STAGES,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'request_latency{scenario:candidate_browsing}': ['p(95)<2000', 'p(99)<5000'],
    'http_failures': ['rate<0.05'],
    'server_errors_5xx': ['rate<0.02'],
    'auth_failures': ['rate<0.01'],
    'checks': ['rate>0.95'],
  },
  noConnectionReuse: false,
  userAgent: 'k6-load-test/1.0 (CXJobs production read-only)',
};

function buildHeaders(extra = {}) {
  return { ...defaultHeaders, ...extra, Cookie: sessionCookieHeader };
}

function recordResponse(res, label) {
  totalRequests.add(1);
  latencyTrend.add(res.timings.duration, { endpoint: label });

  if (res.status >= 200 && res.status < 300) {
    successfulRequests.add(1);
  } else {
    httpFailures.add(1);
    if (res.status === 429) {
      rateLimitResponses.add(1);
    } else if (res.status >= 400 && res.status < 500) {
      clientErrors.add(1);
    } else if (res.status >= 500) {
      serverErrors.add(1);
    }
  }
}

function validateSession() {
  const res = http.get(`${BASE_URL}/api/auth/session`, {
    headers: buildHeaders(),
    tags: { endpoint: 'auth_session' },
  });

  recordResponse(res, 'auth_session');

  const authenticated = check(res, {
    'session response is 200': (r) => r.status === 200,
    'session has user': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.user !== undefined;
      } catch {
        return false;
      }
    },
    'session user is candidate': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.user?.role === 'CANDIDATE' || body?.user?.email !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!authenticated) {
    authFailures.add(1);
    console.error('Authentication validation failed. Stopping test.');
    console.error(`Status: ${res.status}, Body: ${res.body.substring(0, 500)}`);
    return false;
  }

  return true;
}

function getDashboard() {
  const res = http.get(`${BASE_URL}/dashboard/candidate`, {
    headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml' }),
    tags: { endpoint: 'dashboard_page' },
  });
  recordResponse(res, 'dashboard_page');
  return check(res, { 'dashboard page loads': (r) => r.status === 200 });
}

function getDashboardData() {
  const res = http.get(`${BASE_URL}/api/dashboard/candidate`, {
    headers: buildHeaders(),
    tags: { endpoint: 'dashboard_api' },
  });
  recordResponse(res, 'dashboard_api');
  return check(res, {
    'dashboard API returns 200': (r) => r.status === 200,
    'dashboard API returns valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
}

function getProfile() {
  const res = http.get(`${BASE_URL}/dashboard/candidate/profile`, {
    headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml' }),
    tags: { endpoint: 'profile_page' },
  });
  recordResponse(res, 'profile_page');
  return check(res, { 'profile page loads': (r) => r.status === 200 });
}

function getApplications() {
  const res = http.get(`${BASE_URL}/dashboard/candidate/applications`, {
    headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml' }),
    tags: { endpoint: 'applications_page' },
  });
  recordResponse(res, 'applications_page');
  return check(res, { 'applications page loads': (r) => r.status === 200 });
}

function getApplicationsAPI() {
  const res = http.get(`${BASE_URL}/api/application`, {
    headers: buildHeaders(),
    tags: { endpoint: 'applications_api' },
  });
  recordResponse(res, 'applications_api');
  return check(res, {
    'applications API returns 200': (r) => r.status === 200,
    'applications API returns valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
}

function getJobOffers() {
  const res = http.get(`${BASE_URL}/api/job-offers`, {
    headers: buildHeaders(),
    tags: { endpoint: 'job_offers_list' },
  });
  recordResponse(res, 'job_offers_list');
  return check(res, {
    'job offers list returns 200': (r) => r.status === 200,
    'job offers list returns valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
}

function extractJobSlug(jobOffersRes) {
  try {
    const data = JSON.parse(jobOffersRes.body);
    const jobs = Array.isArray(data) ? data : (data?.jobs ?? data?.data ?? data?.results ?? []);
    if (jobs.length > 0) {
      const job = jobs[0];
      return job.slug || job.id;
    }
  } catch (e) {
    console.warn('Failed to parse job offers response:', e.message);
  }
  return null;
}

function getJobDetail(slug) {
  if (!slug) {
    console.warn('No job slug available, skipping job detail request');
    return { success: false, slug: null };
  }

  const res = http.get(`${BASE_URL}/jobs/${slug}`, {
    headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml' }),
    tags: { endpoint: 'job_detail_page' },
  });
  recordResponse(res, 'job_detail_page');

  const checks = check(res, {
    'job detail page loads': (r) => r.status === 200,
  });

  const apiRes = http.get(`${BASE_URL}/api/job-offers/by-slug/${slug}`, {
    headers: buildHeaders(),
    tags: { endpoint: 'job_detail_api' },
  });
  recordResponse(apiRes, 'job_detail_api');

  check(apiRes, {
    'job detail API returns 200': (r) => r.status === 200,
    'job detail API returns valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  return { success: checks, slug };
}

export default function () {
  if (!validateSession()) {
    return;
  }

  group('Candidate Dashboard', () => {
    getDashboard();
    sleep(1.5);

    getDashboardData();
    sleep(1);
  });

  group('Candidate Profile', () => {
    getProfile();
    sleep(1.5);
  });

  group('Candidate Applications', () => {
    getApplications();
    sleep(1);

    getApplicationsAPI();
    sleep(1);
  });

  group('Job Offers Browsing', () => {
    const jobOffersRes = http.get(`${BASE_URL}/api/job-offers`, {
      headers: buildHeaders(),
      tags: { endpoint: 'job_offers_list' },
    });
    recordResponse(jobOffersRes, 'job_offers_list');

    const jobOffersOk = check(jobOffersRes, {
      'job offers list returns 200': (r) => r.status === 200,
      'job offers list returns valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });

    sleep(2);

    if (jobOffersOk) {
      const slug = extractJobSlug(jobOffersRes);
      if (slug) {
        group('Job Detail', () => {
          getJobDetail(slug);
          sleep(2);
        });
      } else {
        console.warn('No jobs found in job offers list, skipping job detail');
      }
    }
  });

  sleep(3);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'CXJobs Production Authenticated Candidate Load Test',
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    stages: DEFAULT_STAGES,
    metrics: {
  totalRequests: metrics.total_requests?.values?.count ?? 0,
  successfulRequests: metrics.successful_requests?.values?.count ?? 0,
  httpFailures: metrics.http_failures?.values?.count ?? 0,
  rateLimit429: metrics.rate_limit_429?.values?.count ?? 0,
  clientErrors4xx: metrics.client_errors_4xx?.values?.count ?? 0,
  serverErrors5xx: metrics.server_errors_5xx?.values?.count ?? 0,

  avgLatencyMs: metrics.request_latency?.values?.avg ?? 0,
  medianLatencyMs: metrics.request_latency?.values?.med ?? 0,
  p90LatencyMs: metrics.request_latency?.values?.['p(90)'] ?? 0,
  p95LatencyMs: metrics.request_latency?.values?.['p(95)'] ?? 0,
  p99LatencyMs: metrics.http_req_duration?.values?.['p(99)'] ?? null,
  maxLatencyMs: metrics.request_latency?.values?.max ?? 0,

  requestsPerSecond: metrics.http_reqs?.values?.rate ?? 0,

  checksPassed: metrics.checks?.values?.passes ?? 0,
  checksFailed: metrics.checks?.values?.fails ?? 0,
  authFailureRate: metrics.auth_failures?.values?.rate ?? 0,
},
    notes: [
      'Test uses a single shared session cookie across all VUs',
      'This tests infrastructure/application under load, not unique user simulation',
      '429 responses are tracked separately from server errors',
      'All operations are read-only; no POST/PUT/PATCH/DELETE',
      'Job view counter endpoint (/api/job-offers/[slug]/views) is intentionally excluded',
    ],
  };
  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}