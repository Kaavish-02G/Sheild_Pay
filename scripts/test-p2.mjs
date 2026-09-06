import { ok, err, done, req, serverUp } from "./lib/test-utils.mjs";

export async function runP2Tests() {
  const results = [];
  if (!(await serverUp())) return 1;

  try {
    const r = await req("GET", "/api/p2/health");
    r.status === 200 ? ok(results, "p2-health") : err(results, "p2-health", `need GET /api/p2/health got ${r.status}`);
  } catch (e) {
    err(results, "p2-health", "add app/api/p2/health/route.ts");
  }

  return done(results, "P2");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("test-p2.mjs");
if (isMain) runP2Tests().then((c) => process.exit(c));
