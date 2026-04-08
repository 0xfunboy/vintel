const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3001";

async function main() {
  const health = await fetch(`${appUrl.replace(/\/$/, "")}/api/health`, {
    headers: {
      accept: "application/json"
    }
  });

  if (!health.ok) {
    throw new Error(`Health check failed: ${health.status}`);
  }

  const payload = await health.json();
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
