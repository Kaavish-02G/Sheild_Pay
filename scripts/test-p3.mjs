import { ok, err, done, req, serverUp } from "./lib/test-utils.mjs";

export async function runP3Tests() {
  const results = [];
  if (!(await serverUp())) return 1;

  try {
    const r = await req("POST", "/api/p3/invoke", { body: { disputeId: "test-none" } });
    r.status < 500 ? ok(results, "p3-invoke") : err(results, "p3-invoke", String(r.status));
  } catch (e) {
    err(results, "p3-invoke", "add app/api/p3/invoke/route.ts");
  }

  return done(results, "P3");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("test-p3.mjs");
if (isMain) runP3Tests().then((c) => process.exit(c));
