// Node 18+ (built-in fetch)
// run SOURCE_URL="https://your-proxy/edisonrulings.json" node scripts/update-pack.mjs

import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL =
  process.env.SOURCE_URL ||
  "https://YOUR_PROXY_HOST/edisonrulings.json";

const OUT_FILE = path.resolve("data/edisonrulings.json");

async function main() {
  if (!SOURCE_URL || SOURCE_URL.includes("YOUR_PROXY_HOST")) {
    console.error("Set SOURCE_URL env var or edit SOURCE_URL in this file.");
    process.exit(1);
  }

  console.log("Downloading:", SOURCE_URL);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const text = await res.text();
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, text, "utf8");

  console.log("Saved:", OUT_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});