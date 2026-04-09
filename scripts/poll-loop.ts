import { pollTrackedSearches } from "../lib/poller";

function getPollIntervalSeconds() {
  const raw = Number(process.env.POLL_INTERVAL_SECONDS ?? "60");
  if (!Number.isFinite(raw) || raw <= 0) {
    return 60;
  }

  return Math.max(10, Math.round(raw));
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let running = true;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    running = false;
  });
}

async function runCycle() {
  const startedAt = new Date().toISOString();

  try {
    const summary = await pollTrackedSearches();
    console.log(
      JSON.stringify({
        type: "poll",
        startedAt,
        intervalSeconds: getPollIntervalSeconds(),
        ok: true,
        summary
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "poll",
        startedAt,
        intervalSeconds: getPollIntervalSeconds(),
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
}

async function main() {
  console.log(
    JSON.stringify({
      type: "poller",
      startedAt: new Date().toISOString(),
      intervalSeconds: getPollIntervalSeconds()
    })
  );

  while (running) {
    const cycleStarted = Date.now();
    await runCycle();

    if (!running) {
      break;
    }

    const waitMs = Math.max(0, getPollIntervalSeconds() * 1000 - (Date.now() - cycleStarted));
    await sleep(waitMs);
  }

  console.log(
    JSON.stringify({
      type: "poller",
      stoppedAt: new Date().toISOString()
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
