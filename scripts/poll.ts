import { pollTrackedSearches } from "../lib/poller";

async function main() {
  const summary = await pollTrackedSearches();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
