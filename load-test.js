import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    public_traffic: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 100 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 300 },
        { duration: "1m", target: 0 },
      ],
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const BASE_URL = "http://localhost:3000";

let JOB_IDS = [];

export function setup() {
  const res = http.get(
    `${BASE_URL}/api/job-offers?page=1&limit=20`
  );

  let jobIds = [];

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);

      if (body.data && Array.isArray(body.data)) {
        jobIds = body.data
          .map((job) => job.id)
          .filter(Boolean);
      }

      if (Array.isArray(body)) {
        jobIds = body
          .map((job) => job.id)
          .filter(Boolean);
      }
    } catch (e) {}
  }

  return {
    jobIds,
  };
}

export default function (data) {
  const jobIds = data.jobIds || [];

  const requests = [];

  // 50% - jobs listing
  requests.push(() =>
    http.get(
      `${BASE_URL}/api/job-offers?page=${
        Math.floor(Math.random() * 5) + 1
      }&limit=20`
    )
  );

  // 30% - job details
  requests.push(() => {
    if (jobIds.length === 0) {
      return http.get(
        `${BASE_URL}/api/job-offers?page=1&limit=1`
      );
    }

    const jobId =
      jobIds[Math.floor(Math.random() * jobIds.length)];

    return http.get(
      `${BASE_URL}/api/job-offers/${jobId}`
    );
  });

  // 20% - applications of a job
  requests.push(() => {
    if (jobIds.length === 0) {
      return http.get(
        `${BASE_URL}/api/job-offers?page=1&limit=1`
      );
    }

    const jobId =
      jobIds[Math.floor(Math.random() * jobIds.length)];

    return http.get(
      `${BASE_URL}/api/job-offers/${jobId}/applications`
    );
  });

  const random =
    Math.floor(Math.random() * requests.length);

  const res = requests[random]();

  check(res, {
    "status 200": (r) => r.status === 200,
    "response < 1s": (r) => r.timings.duration < 1000,
    "not 500": (r) => r.status !== 500,
  });

 if (res.status !== 200) {
  console.log(`${res.request.url} => ${res.status}`);
}

  sleep(Math.random() * 2 + 1);
}