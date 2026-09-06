import "./lib/env.mjs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { runP1ApiTests } from "./p1/api.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function runP1Tests() {
  const unit = spawnSync(process.execPath, [
    join(root, "node_modules/tsx/dist/cli.mjs"),
    join(root, "scripts/p1/unit.ts"),
  ], { cwd: root, stdio: "pipe", env: process.env });

  const out = (unit.stdout?.toString() ?? "") + (unit.stderr?.toString() ?? "");
  process.stdout.write(out);
  const match = out.match(/unit: (\d+)\/(\d+)/);
  if (!match || match[1] !== match[2]) return 1;

  const apiCode = await runP1ApiTests();
  const apiTotal = 14;
  const unitTotal = Number(match[2]);
  const total = unitTotal + apiTotal;
  console.log(`P1: ${apiCode === 0 ? total : "FAIL"}/${total}`);
  return apiCode;
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("test-p1.mjs");
if (isMain) runP1Tests().then((c) => process.exit(c));
