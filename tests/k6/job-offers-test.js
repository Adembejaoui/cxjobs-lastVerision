import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    job_offers_list: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '90s', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    job_offer_detail: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '90s', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration{name:job_offers_list}': ['p(95)<2000', 'p(99)<5000'],
    'http_req_duration{name:job_offer_detail}': ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const BASE_URL = 'http://localhost:3000';
const jobOfferIds = [];

export function setup() {
  const res = http.get(`${BASE_URL}/api/job-offers?limit=20`, {
    tags: { name: 'job_offers_list_setup' },
  });
  
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      if (data.data && data.data.length > 0) {
        data.data.forEach(job => jobOfferIds.push(job.id));
      }
    } catch {
      console.log('Could not parse job offers for setup');
    }
  }
  
  return { jobOfferIds };
}

export default function run(data) {
  const jobIds = data.jobOfferIds || [];
  
  group('List Job Offers', () => {
    const listRes = http.get(`${BASE_URL}/api/job-offers?limit=20`, {
      tags: { name: 'job_offers_list' },
    });
    
    check(listRes, {
      'list status is 200': (r) => r.status === 200,
      'list has data': (r) => {
        try {
          const d = JSON.parse(r.body);
          return d.success === true && Array.isArray(d.data);
        } catch {
          return false;
        }
      },
      'list response time < 2000ms': (r) => r.timings.duration < 2000,
    });
  });
  
  sleep(1);
  
  if (jobIds.length > 0) {
    const randomJobId = jobIds[Math.floor(Math.random() * jobIds.length)];
    
    group('Get Job Offer Detail', () => {
      const detailRes = http.get(`${BASE_URL}/api/job-offers/${randomJobId}`, {
        tags: { name: 'job_offer_detail' },
      });
      
      check(detailRes, {
        'detail status is 200': (r) => r.status === 200,
        'detail has data': (r) => {
          try {
            const d = JSON.parse(r.body);
            return d.success === true && d.data && d.data.id === randomJobId;
          } catch {
            return false;
          }
        },
        'detail response time < 2000ms': (r) => r.timings.duration < 2000,
      });
    });
    
    sleep(1);
  }
}

export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
  };
  return summary;
}

function textSummary(data, options = {}) {
  const { indent = '', enableColors = false } = options;
  const color = enableColors ? (str) => `\x1b[32m${str}\x1b[0m` : (str) => str;
  const red = enableColors ? (str) => `\x1b[31m${str}\x1b[0m` : (str) => str;
  
  let output = '';
  output += `${indent}${color('Test Summary')}\n`;
  output += `${indent}${color('='.repeat(50))}\n\n`;
  
  if (data.metrics.http_req_duration) {
    const m = data.metrics.http_req_duration;
    output += `${indent}${color('HTTP Request Duration (all)')}\n`;
    output += `${indent}  avg: ${m.values.avg.toFixed(2)}ms\n`;
    output += `${indent}  min: ${m.values.min.toFixed(2)}ms\n`;
    output += `${indent}  med: ${m.values.med.toFixed(2)}ms\n`;
    output += `${indent}  max: ${m.values.max.toFixed(2)}ms\n`;
    output += `${indent}  p(90): ${m.values['p(90)'].toFixed(2)}ms\n`;
    output += `${indent}  p(95): ${m.values['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  p(99): ${m.values['p(99)'].toFixed(2)}ms\n\n`;
  }
  
  Object.keys(data.metrics).forEach(key => {
    if (key.startsWith('http_req_duration{') && key.includes('name:')) {
      const m = data.metrics[key];
      const name = key.match(/name:([^}]+)/)[1];
      output += `${indent}${color(`HTTP Request Duration (${name})`)}\n`;
      output += `${indent}  avg: ${m.values.avg.toFixed(2)}ms\n`;
      output += `${indent}  min: ${m.values.min.toFixed(2)}ms\n`;
      output += `${indent}  med: ${m.values.med.toFixed(2)}ms\n`;
      output += `${indent}  max: ${m.values.max.toFixed(2)}ms\n`;
      output += `${indent}  p(90): ${m.values['p(90)'].toFixed(2)}ms\n`;
      output += `${indent}  p(95): ${m.values['p(95)'].toFixed(2)}ms\n`;
      output += `${indent}  p(99): ${m.values['p(99)'].toFixed(2)}ms\n\n`;
    }
  });
  
  if (data.metrics.http_reqs) {
    output += `${indent}${color('Throughput')}\n`;
    output += `${indent}  Total requests: ${data.metrics.http_reqs.values.count}\n`;
    output += `${indent}  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s\n\n`;
  }
  
  if (data.metrics.http_req_failed) {
    output += `${indent}${color('Error Rate')}\n`;
    output += `${indent}  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  if (data.metrics.checks) {
    output += `${indent}${color('Checks')}\n`;
    Object.entries(data.metrics.checks.values).forEach(([checkName, checkData]) => {
      const passRate = (checkData.passes / (checkData.passes + checkData.fails) * 100).toFixed(2);
      const status = checkData.passes > checkData.fails ? color('✓') : red('✗');
      output += `${indent}  ${status} ${checkName}: ${passRate}% (${checkData.passes}/${checkData.passes + checkData.fails})\n`;
    });
  }
  
  return output;
}