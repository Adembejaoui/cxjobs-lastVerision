import "dotenv/config";
import prisma from "./lib/prisma";

// Suppress query logging for this test

interface TestResult {
  concurrency: number;
  iterations: number;
  success: number;
  failure: number;
  latencies: number[];
  errors: Record<string, number>;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
}

async function runTest(concurrency: number, iterations: number): Promise<TestResult> {
  const latencies: number[] = [];
  const errors: Record<string, number> = {};
  let success = 0;
  let failure = 0;

  console.log(`\n=== Testing concurrency: ${concurrency}, iterations: ${iterations} ===`);

  for (let iter = 0; iter < iterations; iter++) {
    const promises = Array.from({ length: concurrency }, async () => {
      const start = Date.now();
      try {
        await prisma.user.findFirst({ where: { id: "test" } });
        const latency = Date.now() - start;
        latencies.push(latency);
        success++;
      } catch (err: any) {
        failure++;
        const errorMsg = err?.message ?? String(err);
        console.log("Actual error:", errorMsg);
        const errorKey = errorMsg.includes("P2024") ? "P2024"
          : errorMsg.includes("P1001") ? "P1001"
          : errorMsg.includes("too many connections") ? "too_many_connections"
          : errorMsg.includes("max clients reached") ? "max_clients_reached"
          : errorMsg.includes("connection timeout") ? "connection_timeout"
          : "other";
        errors[errorKey] = (errors[errorKey] || 0) + 1;
      }
    });

    await Promise.all(promises);
    
    if ((iter + 1) % 10 === 0) {
      console.log(`  Iteration ${iter + 1}/${iterations} complete`);
    }
  }

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);
  const p95Latency = latencies[p95Index] || 0;
  const p99Latency = latencies[p99Index] || 0;

  return {
    concurrency,
    iterations,
    success,
    failure,
    latencies,
    errors,
    avgLatency,
    p95Latency,
    p99Latency,
  };
}

function printResult(result: TestResult) {
  console.log(`\n--- Results for concurrency ${result.concurrency} ---`);
  console.log(`Success: ${result.success}`);
  console.log(`Failure: ${result.failure}`);
  console.log(`Avg latency: ${result.avgLatency.toFixed(2)}ms`);
  console.log(`P95 latency: ${result.p95Latency}ms`);
  console.log(`P99 latency: ${result.p99Latency}ms`);
  console.log(`Errors:`, result.errors);
}

async function main() {
  console.log("Starting Prisma connection stress test...");
  console.log("Pool config: max=15, connectionTimeout=5000ms, idleTimeout=10000ms");
  
  await prisma.$connect();
  console.log("Prisma connected");

  const testConfigs = [
    { concurrency: 100, iterations: 50 },
    { concurrency: 300, iterations: 50 },
    { concurrency: 500, iterations: 50 },
  ];

  const results: TestResult[] = [];

  for (const config of testConfigs) {
    const result = await runTest(config.concurrency, config.iterations);
    results.push(result);
    printResult(result);
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`${r.concurrency} concurrent: success=${r.success}, fail=${r.failure}, avg=${r.avgLatency.toFixed(1)}ms, p95=${r.p95Latency}ms, errors=${JSON.stringify(r.errors)}`);
  }

  // Verdict logic
  const hasPoolErrors = results.some(r => 
    r.errors.P2024 || r.errors.P1001 || r.errors.too_many_connections || r.errors.max_clients_reached || r.errors.connection_timeout
  );
  
  const highFailureRate = results.some(r => r.failure / (r.success + r.failure) > 0.05);
  const highLatency = results.some(r => r.p95Latency > 1000);

  console.log("\n=== VERDICT ===");
  if (hasPoolErrors || highFailureRate) {
    console.log("PRISMA POOL IS THE BOTTLENECK");
    console.log("Evidence: Pool errors (P2024/P1001/too_many_connections) or high failure rate detected");
  } else if (highLatency) {
    console.log("PRISMA POOL IS THE BOTTLENECK");
    console.log("Evidence: High P95 latency (>1000ms) indicating pool contention");
  } else {
    console.log("PRISMA POOL HEALTHY");
    console.log("Evidence: No pool errors, low failure rate, acceptable latency");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Test failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});