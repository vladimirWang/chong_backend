type Options = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  concurrency: number;
  requests: number;
  warmup: number;
  timeoutMs: number;
};

function envNum(name: string, fallback: number) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

async function timedFetch(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const start = Bun.nanoseconds();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const end = Bun.nanoseconds();
    return { ok: res.ok, status: res.status, ns: end - start };
  } catch (e) {
    const end = Bun.nanoseconds();
    return { ok: false, status: 0, ns: end - start, error: e };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const opts: Options = {
    url: process.env.URL ?? "http://localhost:3000/nodejs_api/stockin",
    method: process.env.METHOD ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(process.env.HEADERS ? JSON.parse(process.env.HEADERS) : {}),
    },
    body: process.env.BODY,
    concurrency: envNum("CONCURRENCY", 20),
    requests: envNum("REQUESTS", 500),
    warmup: envNum("WARMUP", 30),
    timeoutMs: envNum("TIMEOUT_MS", 5000),
  };

  const init: RequestInit = {
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
  };

  // warmup
  for (let i = 0; i < opts.warmup; i++) {
    await timedFetch(opts.url, init, opts.timeoutMs);
  }

  const latenciesMs: number[] = [];
  let ok = 0;
  let fail = 0;
  const startAll = Bun.nanoseconds();

  let idx = 0;
  async function worker() {
    while (true) {
      const my = idx++;
      if (my >= opts.requests) break;
      const r = await timedFetch(opts.url, init, opts.timeoutMs);
      const ms = Number(r.ns) / 1e6;
      latenciesMs.push(ms);
      if (r.ok) ok++;
      else fail++;
    }
  }

  await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));
  const endAll = Bun.nanoseconds();

  latenciesMs.sort((a, b) => a - b);
  const totalSec = Number(endAll - startAll) / 1e9;
  const rps = opts.requests / totalSec;

  const p50 = percentile(latenciesMs, 50);
  const p90 = percentile(latenciesMs, 90);
  const p95 = percentile(latenciesMs, 95);
  const p99 = percentile(latenciesMs, 99);
  const min = latenciesMs[0] ?? NaN;
  const max = latenciesMs[latenciesMs.length - 1] ?? NaN;

  console.log(
    JSON.stringify(
      {
        url: opts.url,
        method: opts.method,
        concurrency: opts.concurrency,
        requests: opts.requests,
        warmup: opts.warmup,
        timeoutMs: opts.timeoutMs,
        ok,
        fail,
        errorRate: opts.requests === 0 ? 0 : fail / opts.requests,
        totalSec,
        rps,
        latencyMs: { min, p50, p90, p95, p99, max },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("性能测试失败:", e);
  process.exit(1);
});
