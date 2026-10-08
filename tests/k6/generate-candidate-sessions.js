const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');

const BASE_URL = process.env.K6_BASE_URL || 'http://localhost:3000';
const TEST_PASSWORD = process.env.K6_TEST_PASSWORD || '12345678';
const CANDIDATE_COUNT = parseInt(
  process.env.K6_CANDIDATE_COUNT || '100',
  10
);
const CANDIDATE_START = parseInt(
  process.env.K6_CANDIDATE_START || '1',
  10
);
const ALLOW_PRODUCTION =
  process.env.K6_ALLOW_PRODUCTION_SESSION_GENERATION === 'true';

const BASE_URL_OBJ = new URL(BASE_URL);
const IS_HTTPS = BASE_URL_OBJ.protocol === 'https:';

const COOKIE_NAME = IS_HTTPS
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

const OUTPUT_FILE =
  process.env.K6_CANDIDATE_COOKIES_FILE ||
  '.k6-candidate-cookies.txt';

/**
 * Check whether the supplied URL should be considered production.
 */
function isProductionUrl(url) {
  try {
    const hostname = new URL(url).hostname;

    return ![
      'localhost',
      '127.0.0.1',
      '::1',
    ].includes(hostname) && !hostname.endsWith('.local');
  } catch {
    return true;
  }
}

/**
 * Perform a Node.js HTTP/HTTPS request.
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * Convert Set-Cookie values into a Cookie header.
 */
function buildCookieHeader(cookies = []) {
  return cookies
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/**
 * Get the CSRF token and initial cookies.
 */
async function getCsrfToken(baseUrl) {
  const url = new URL('/api/auth/csrf', baseUrl);

  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port:
      url.port ||
      (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CXJobs-Session-Generator/1.0',
    },
  };

  const res = await makeRequest(options);

  if (res.statusCode !== 200) {
    throw new Error(
      `Failed to get CSRF token: HTTP ${res.statusCode}`
    );
  }

  let data;

  try {
    data = JSON.parse(res.body);
  } catch {
    throw new Error('Invalid JSON returned by CSRF endpoint');
  }

  if (!data.csrfToken) {
    throw new Error('CSRF token missing from response');
  }

  return {
    csrfToken: data.csrfToken,
    cookies: res.headers['set-cookie'] || [],
  };
}

/**
 * Login a candidate using NextAuth/Auth.js credentials.
 */
async function loginCandidate(
  baseUrl,
  email,
  password,
  csrfToken,
  initialCookies = []
) {
  const url = new URL(
    '/api/auth/callback/credentials',
    baseUrl
  );

  const postData = new URLSearchParams({
    email,
    password,
    csrfToken,
    callbackUrl: `${baseUrl}/dashboard`,
    json: 'true',
  }).toString();

  const cookieHeader = buildCookieHeader(initialCookies);

  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port:
      url.port ||
      (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'CXJobs-Session-Generator/1.0',
      ...(cookieHeader
        ? { Cookie: cookieHeader }
        : {}),
    },
  };

  let res = await makeRequest(options, postData);

  let allSetCookies = [
    ...(res.headers['set-cookie'] || []),
  ];

  let redirectCount = 0;

  /**
   * Auth.js may return a redirect after successful
   * credentials authentication.
   */
  while (
    (res.statusCode === 301 ||
      res.statusCode === 302 ||
      res.statusCode === 303 ||
      res.statusCode === 307 ||
      res.statusCode === 308) &&
    redirectCount < 5
  ) {
    const location = res.headers.location;

    if (!location) {
      break;
    }

    const redirectUrl = new URL(
      location,
      baseUrl
    );

    const redirectCookieHeader =
      buildCookieHeader(allSetCookies);

    const redirectOptions = {
      protocol: redirectUrl.protocol,
      hostname: redirectUrl.hostname,
      port:
        redirectUrl.port ||
        (redirectUrl.protocol === 'https:' ? 443 : 80),
      path:
        redirectUrl.pathname +
        redirectUrl.search,
      method: 'GET',
      headers: {
        Accept:
          'application/json, text/html, */*',
        'User-Agent':
          'CXJobs-Session-Generator/1.0',
        ...(redirectCookieHeader
          ? { Cookie: redirectCookieHeader }
          : {}),
      },
    };

    res = await makeRequest(redirectOptions);

    if (res.headers['set-cookie']) {
      allSetCookies = allSetCookies.concat(
        res.headers['set-cookie']
      );
    }

    redirectCount++;
  }

  return {
    statusCode: res.statusCode,
    allCookies: allSetCookies,
  };
}

/**
 * Validate the authenticated session.
 */
async function validateSession(
  baseUrl,
  sessionCookieValue
) {
  const url = new URL(
    '/api/auth/session',
    baseUrl
  );

  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port:
      url.port ||
      (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'CXJobs-Session-Generator/1.0',
      Cookie:
        `${COOKIE_NAME}=${sessionCookieValue}`,
    },
  };

  const res = await makeRequest(options);

  if (res.statusCode !== 200) {
    return {
      valid: false,
      reason: `HTTP ${res.statusCode}`,
    };
  }

  let data;

  try {
    data = JSON.parse(res.body);
  } catch {
    return {
      valid: false,
      reason: 'Invalid JSON response',
    };
  }

  if (!data.user) {
    return {
      valid: false,
      reason: 'No user in session',
    };
  }

  if (data.user.role !== 'CANDIDATE') {
    return {
      valid: false,
      reason:
        `Role is ${data.user.role}, expected CANDIDATE`,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Reconstruct the Auth.js session cookie from
 * Set-Cookie headers.
 *
 * Auth.js chunks oversized JWTs into
 * <name>.0, <name>.1, ... and reassembles them
 * by ascending numeric suffix. The same order is
 * reproduced here so no chunk is lost.
 *
 * Returns the complete session token value, or
 * null when no session cookie was present.
 */
function extractSessionCookie(
  allCookies = [],
  cookieName = COOKIE_NAME
) {
  const chunks = new Map();
  let unchunked = null;

  for (const cookie of allCookies) {
    const pair = cookie.split(';')[0];
    const separator = pair.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);

    if (!value) {
      continue;
    }

    if (name === cookieName) {
      unchunked = value;
      continue;
    }

    if (name.startsWith(`${cookieName}.`)) {
      const suffix = name.slice(
        cookieName.length + 1
      );
      const index = Number.parseInt(suffix, 10);

      if (
        Number.isInteger(index) &&
        index >= 0 &&
        String(index) === suffix
      ) {
        chunks.set(index, value);
      }
    }
  }

  if (unchunked) {
    return unchunked;
  }

  if (chunks.size === 0) {
    return null;
  }

  const sortedIndexes = [...chunks.keys()].sort(
    (a, b) => a - b
  );

  /**
   * Chunks must form a contiguous 0..n-1 range,
   * otherwise the reconstructed value would be
   * corrupted.
   */
  const isContiguous = sortedIndexes.every(
    (index, position) => index === position
  );

  if (!isContiguous) {
    return null;
  }

  const value = sortedIndexes
    .map((index) => chunks.get(index))
    .join('');

  return value || null;
}

/**
 * Main session-generation workflow.
 */
async function main() {
  console.log(
    'CXJobs Candidate Session Generator\n'
  );

  console.log(`Base URL: ${BASE_URL}`);
  console.log(
    `Candidates: ${CANDIDATE_COUNT} ` +
    `(starting from ${CANDIDATE_START})`
  );
  console.log(
    `Cookie type: ${COOKIE_NAME}`
  );
  console.log('');

  /**
   * Safety protection against accidentally
   * generating production sessions.
   */
  if (
    isProductionUrl(BASE_URL) &&
    !ALLOW_PRODUCTION
  ) {
    console.error(
      'ERROR: K6_BASE_URL appears to be a production URL.'
    );

    console.error(
      'Set K6_ALLOW_PRODUCTION_SESSION_GENERATION=true to proceed.'
    );

    console.error(
      'This protection prevents accidental production session generation.'
    );

    process.exit(1);
  }

  if (isProductionUrl(BASE_URL)) {
    console.warn(
      'WARNING: Generating authenticated sessions against production.'
    );

    console.warn(
      'Make sure this is intentional and that these are test accounts.\n'
    );
  }

  const results = {
    authenticated: 0,
    failed: 0,
    cookies: [],
    failures: [],
  };

  const seen = new Set();

  /**
   * Generate sessions sequentially.
   */
  for (
    let i = CANDIDATE_START;
    i < CANDIDATE_START + CANDIDATE_COUNT;
    i++
  ) {
    const email = `user${i}@gmail.com`;

    process.stdout.write(
      `  ${email} ... `
    );

    try {
      /**
       * 1. Get CSRF token.
       */
      const {
        csrfToken,
        cookies: initialCookies,
      } = await getCsrfToken(BASE_URL);

      /**
       * 2. Login candidate.
       */
      const loginResult =
        await loginCandidate(
          BASE_URL,
          email,
          TEST_PASSWORD,
          csrfToken,
          initialCookies
        );

      /**
       * 3. Extract session cookie.
       * Chunked cookies are reassembled here.
       */
      const sessionCookieValue =
        extractSessionCookie(
          loginResult.allCookies
        );

      if (!sessionCookieValue) {
        throw new Error(
          'No session cookie received'
        );
      }

      if (seen.has(sessionCookieValue)) {
        throw new Error(
          'Duplicate session cookie returned'
        );
      }

      /**
       * 4. Validate session.
       */
      const validation =
        await validateSession(
          BASE_URL,
          sessionCookieValue
        );

      if (!validation.valid) {
        throw new Error(
          validation.reason
        );
      }

      /**
       * 5. Store session.
       */
      results.authenticated++;

      seen.add(sessionCookieValue);

      results.cookies.push(
        sessionCookieValue
      );

      console.log('✓');
    } catch (error) {
      results.failed++;

      const safeMessage =
        error instanceof Error
          ? error.message
          : String(error);

      results.failures.push({
        email,
        error: safeMessage,
      });

      console.log(
        `✗ (${safeMessage})`
      );
    }
  }

  console.log(
    '\n--------------------------------'
  );

  console.log(
    `Authenticated: ${results.authenticated}/${CANDIDATE_COUNT}`
  );

  console.log(
    `Failed:        ${results.failed}/${CANDIDATE_COUNT}`
  );

  console.log(
    '--------------------------------\n'
  );

  /**
   * Show failed accounts and safe error messages.
   * Never print cookies, tokens, passwords, or response bodies.
   */
  if (results.failures.length > 0) {
    console.log('Failed accounts:');

    for (const failure of results.failures) {
      console.log(
        `  ${failure.email}: ${failure.error}`
      );
    }

    console.log('');
  }

  /**
   * Never write an empty session cookie to disk.
   */
  if (
    results.cookies.some((cookie) => !cookie)
  ) {
    console.error(
      'ERROR: Empty session cookie detected. File not written.'
    );

    process.exit(1);
  }

  /**
   * Save cookies for the actual k6 load test.
   */
  if (results.cookies.length > 0) {
    const output =
      results.cookies.join(',');

    fs.writeFileSync(
      OUTPUT_FILE,
      output,
      'utf8'
    );

    console.log(
      `✓ Cookies saved to ${OUTPUT_FILE}`
    );

    console.log(
      '✓ Cookie values were not printed'
    );

    console.log(
      `✓ Generated ${results.cookies.length} authenticated session(s)`
    );

    console.log('');
  } else {
    console.error(
      'ERROR: No valid sessions generated.'
    );

    console.error(
      'Cookie file was not created.'
    );

    process.exit(1);
  }

  /**
   * Return a non-zero exit code if some accounts failed.
   * This makes partial generation visible in CI/automation.
   */
  if (results.failed > 0) {
    console.warn(
      `WARNING: ${results.failed} candidate session(s) failed.`
    );
  }
}

main().catch((error) => {
  console.error(
    'Fatal error:',
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exit(1);
});