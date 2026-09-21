import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const jobOfferIds = [
  "743b18f5-f671-4081-8992-57672fc7fa45",
  "82bedee6-f3c2-4c18-b67a-afcfa94ba762",
  "d010c262-4bf9-44af-9bc4-698303daef63",
  "1fd7362c-b866-437a-9776-dff99827f42c",
  "34533e81-9a02-42d0-baa1-58ad076b6206",
  "a8beecd5-942c-4f5c-954e-829b201dbe87",
  "dd9c00de-32da-46b1-a7b4-d1c57d580f03",
  "2d3e61fe-5967-4906-9ae7-994f3e5fb482",
  "3125a1b8-77dd-4f0a-bd6e-3e8901006b86",
  "517bf6d6-ff1d-4302-89f3-74058cc80ec8",
  "b88e85f3-ed1e-4509-bd7e-fb915fd3286e",
  "08f26248-bd3a-4f5b-bf92-e22738848a38",
  "5da5d4fc-a85e-47f2-8010-2b6f18617739",
  "352b1e94-08b3-492f-8569-ca93193b0a83",
  "3fb5231a-1f56-4dd0-b68f-a3bf092b16ca",
  "5a29fd22-7401-4627-ade0-aca03fa0b3f4",
  "73f1b08f-f0c6-497a-b783-b8b3124d3bf9",
  "7bc2d7ef-c5e0-4ab6-a69a-201a9a2fc718",
  "28d95873-e7b9-4870-b9e7-556978ba985d",
  "7b3e1cfa-5858-4ccf-8cfc-fc263608434f",
  "927a672a-e2e9-4012-82e0-c1f3525596ec",
  "529f9319-fd8c-4754-8cd2-cf4e1963e13d",
  "3b772dac-29eb-4a21-8247-1f55415696ea",
  "ad97e4d6-4037-45a1-8cc0-e7e1299a5a4d",
  "3535f645-ac8d-4a5f-8e67-db303357f2b1",
  "c5753485-d4c0-4527-bb10-f118a01b9773",
  "0af841d4-443b-4deb-ba78-9bf4b2f63e8e",
  "0134cc7f-0550-468f-b066-6f1c9732f8e9",
  "f30ebe72-b6dd-4263-8159-27f63b63f063",
  "69e72a71-2578-47a8-aa4f-34a3504cb8e9",
  "1f21d59c-04c1-43cc-abcc-3edc1ad85deb",
  "bc2e8011-71a4-40e2-a02d-84238abc1d57",
  "0b3f9d3f-fd4f-4395-9229-0141876e7c14",
  "12c2addf-f556-482e-b36f-bf2635680666",
  "79c74883-89da-4130-bf7b-dbbda3f77a78",
  "a9ea5ab9-2864-496f-9343-44a9b4864cbf",
  "bb46e41e-b1c9-4112-9639-42757187e08b",
  "743d7590-6b43-4b28-aaa7-fdd8529e383d",
  "ff6f7baa-6878-45b0-b2c6-1042ffcad21e",
  "73efee29-5704-425b-9f73-d36e8e2f7f7c",
  "0ccce3e5-5a5d-44b8-837e-eb279b189dba",
  "77b73d5b-cebb-4861-ada1-4124778e868b",
  "58b7b64f-bd4b-4ad1-bc1e-3e3a7e9d9d6c",
  "b3ec1d92-a196-4b55-98ed-0990de48337d",
  "6b47e96e-f094-4457-91a9-241ff2e15210",
  "0db4ce28-f617-4702-9d75-03e364ada185",
  "8c3a1aa9-7499-4179-a9d8-da69f3ca3105",
  "7f9ee2b6-2a07-4aa0-975f-aecda44ed093",
  "1a0717c2-9856-4952-a12f-117860862494",
  "2f9b747a-c133-40fb-856d-42d1a801a3d4",
  "f96fc4e0-e8a5-4767-9e09-ada60cbc45d2",
  "8aaaff88-732f-4c7a-af7b-4a32d9756901",
  "77852a1c-a9b0-4a7a-9f4d-f69b0a38f023",
  "6e387992-4f39-4a5e-8917-1735b88e1b5f",
  "cba641d0-0f0f-4adf-8bd0-0b806bffbd2a",
  "3d599ef1-525f-4052-a7e5-a24558fb78b9",
  "a1a71346-d997-49cd-9b02-be9a0b86c773",
  "1c49cf2d-6064-4f0b-adcf-7246cd164715",
  "ffafef88-3efa-44d9-b491-bedd1a287398",
  "b7e10e30-2c4e-49cd-8978-1d03bef2db63",
];

const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 25;
const DURATION = __ENV.DURATION || '120s';
const OUTPUT_FILE = __ENV.OUTPUT || `tests/k6/results-${VUS}vus.json`;

const status200 = new Counter('status_200');
const status404 = new Counter('status_404');
const status500 = new Counter('status_500');
const statusOther = new Counter('status_other');
const timeoutErrors = new Counter('timeout_errors');
const connectionErrors = new Counter('connection_errors');
const listDuration = new Trend('list_duration', true);
const detailDuration = new Trend('detail_duration', true);

export const options = {
  scenarios: {
    load_test: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      gracefulStop: '5s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health_check' },
  });
  console.log(`Setup: health=${healthRes.status}`);

  const listRes = http.get(`${BASE_URL}/api/job-offers?limit=20`, {
    tags: { name: 'list_setup' },
  });
  console.log(`Setup: list endpoint=${listRes.status}, body has data=${listRes.json('success', '') === true}`);

  const detailRes = http.get(`${BASE_URL}/api/job-offers/${jobOfferIds[0]}`, {
    tags: { name: 'detail_setup' },
  });
  console.log(`Setup: detail endpoint=${detailRes.status}, body has data=${detailRes.json('success', '') === true}`);

  return { jobOfferIds };
}

export default function run(data) {
  const ids = data?.jobOfferIds || jobOfferIds;

  group('List Job Offers', () => {
    const res = http.get(`${BASE_URL}/api/job-offers?limit=20&page=1`, {
      tags: { name: 'job_offers_list', endpoint: 'list' },
    });

    check(res, {
      'list status is 200': (r) => r.status === 200,
    });

    classifyResponse(res, 'list');
    listDuration.add(res.timings.duration, { status: String(res.status) });
  });

  sleep(0.5);

  group('Get Job Offer Detail', () => {
    const jobId = ids[Math.floor(Math.random() * ids.length)];
    const res = http.get(`${BASE_URL}/api/job-offers/${jobId}`, {
      tags: { name: 'job_offer_detail', endpoint: 'detail' },
    });

    check(res, {
      'detail status is 200': (r) => r.status === 200,
      'detail returns correct job': (r) => {
        try {
          return r.json('data.id') === jobId;
        } catch { return false; }
      },
    });

    classifyResponse(res, 'detail');
    detailDuration.add(res.timings.duration, { status: String(res.status) });
  });

  sleep(0.5);
}

function classifyResponse(res, endpoint) {
  const status = res.status;

  if (status === 200) status200.add(1, { endpoint });
  else if (status === 404) status404.add(1, { endpoint });
  else if (status >= 500) status500.add(1, { endpoint });
  else statusOther.add(1, { endpoint });

  if (res.error) {
    if (res.error.includes('timeout') || res.error.includes('timeout')) {
      timeoutErrors.add(1, { endpoint, error: res.error });
    } else {
      connectionErrors.add(1, { endpoint, error: res.error });
    }
  }
}

export function handleSummary(data) {
  const hr = data.metrics.http_req_duration;
  const hrr = data.metrics.http_reqs;
  const hrf = data.metrics.http_req_failed;

  const listTrend = data.metrics.list_duration;
  const detailTrend = data.metrics.detail_duration;
  const listReqs = data.metrics['http_reqs{name:job_offers_list}'];
  const detailReqs = data.metrics['http_reqs{name:job_offer_detail}'];
  const listErr = data.metrics['http_req_failed{name:job_offers_list}'];
  const detailErr = data.metrics['http_req_failed{name:job_offer_detail}'];

  const fmtMs = (v) => v !== undefined ? Number(v).toFixed(2) + 'ms' : 'N/A';

  let text = '';
  text += '\n========================================\n';
  text += `  K6 LOAD TEST RESULTS - ${VUS} VUs - ${DURATION}\n`;
  text += '========================================\n\n';

  text += `Total requests:       ${hrr ? Number(hrr.values.count) : 0}\n`;
  text += `Requests/sec:         ${hrr ? Number(hrr.values.rate).toFixed(2) : 0} req/s\n`;
  text += `Error rate:           ${hrf ? (Number(hrf.values.rate) * 100).toFixed(2) : 0}%\n\n`;

  text += '-- Overall HTTP Duration --\n';
  text += `  avg: ${fmtMs(hr?.values?.avg)}\n`;
  text += `  p90: ${fmtMs(hr?.values?.['p(90)'])}\n`;
  text += `  p95: ${fmtMs(hr?.values?.['p(95)'])}\n`;
  text += `  p99: ${fmtMs(hr?.values?.['p(99)'])}\n`;
  text += `  min: ${fmtMs(hr?.values?.min)}\n`;
  text += `  max: ${fmtMs(hr?.values?.max)}\n\n`;

  text += '-- Job List (GET /api/job-offers?limit=20) --\n';
  text += `  Requests:   ${listReqs ? Number(listReqs.values.count) : 0}\n`;
  text += `  RPS:        ${listReqs ? Number(listReqs.values.rate).toFixed(2) : 0}\n`;
  text += `  Error rate: ${listErr ? (Number(listErr.values.rate) * 100).toFixed(2) : 0}%\n`;
  text += `  avg: ${fmtMs(listTrend?.values?.avg)}\n`;
  text += `  p90: ${fmtMs(listTrend?.values?.['p(90)'])}\n`;
  text += `  p95: ${fmtMs(listTrend?.values?.['p(95)'])}\n`;
  text += `  p99: ${fmtMs(listTrend?.values?.['p(99)'])}\n\n`;

  text += '-- Job Detail (GET /api/job-offers/[id]) --\n';
  text += `  Requests:   ${detailReqs ? Number(detailReqs.values.count) : 0}\n`;
  text += `  RPS:        ${detailReqs ? Number(detailReqs.values.rate).toFixed(2) : 0}\n`;
  text += `  Error rate: ${detailErr ? (Number(detailErr.values.rate) * 100).toFixed(2) : 0}%\n`;
  text += `  avg: ${fmtMs(detailTrend?.values?.avg)}\n`;
  text += `  p90: ${fmtMs(detailTrend?.values?.['p(90)'])}\n`;
  text += `  p95: ${fmtMs(detailTrend?.values?.['p(95)'])}\n`;
  text += `  p99: ${fmtMs(detailTrend?.values?.['p(99)'])}\n\n`;

  text += '-- HTTP Status Codes --\n';
  const s200 = data.metrics.status_200 ? Number(data.metrics.status_200.values.count) : 0;
  const s404 = data.metrics.status_404 ? Number(data.metrics.status_404.values.count) : 0;
  const s500 = data.metrics.status_500 ? Number(data.metrics.status_500.values.count) : 0;
  const sOther = data.metrics.status_other ? Number(data.metrics.status_other.values.count) : 0;
  text += `  2xx (200):   ${s200}\n`;
  text += `  4xx (404):   ${s404}\n`;
  text += `  5xx (5xx):   ${s500}\n`;
  text += `  Other:       ${sOther}\n\n`;

  text += '-- Errors --\n';
  const timeouts = data.metrics.timeout_errors ? Number(data.metrics.timeout_errors.values.count) : 0;
  const connErrors = data.metrics.connection_errors ? Number(data.metrics.connection_errors.values.count) : 0;
  text += `  Timeouts:         ${timeouts}\n`;
  text += `  Connection errors: ${connErrors}\n`;

  text += '\n';

  return {
    stdout: text,
    [OUTPUT_FILE]: JSON.stringify(data, null, 2),
  };
}
