#!/usr/bin/env node
/** Usage: node scripts/test.mjs [p1|p2|p3|p4|all] */
import { runP1Tests } from "./test-p1.mjs";
import { runP2Tests } from "./test-p2.mjs";
import { runP3Tests } from "./test-p3.mjs";
import { runP4Tests } from "./test-p4.mjs";

const mod = (process.argv[2] ?? "all").toLowerCase();
const runners = { p1: runP1Tests, p2: runP2Tests, p3: runP3Tests, p4: runP4Tests };

async function main() {
  if (mod === "all") {
    let code = 0;
    for (const [name, fn] of Object.entries(runners)) {
      console.log(`\n--- ${name} ---`);
      const c = await fn();
      if (c !== 0) code = 1;
    }
    process.exit(code);
  }
  if (!runners[mod]) {
    console.error(`Unknown module: ${mod}. Use p1|p2|p3|p4|all`);
    process.exit(1);
  }
  process.exit(await runners[mod]());
}

main();
