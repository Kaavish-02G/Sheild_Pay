import { ok, err, done, req, serverUp } from "./lib/test-utils.mjs";

export async function runP4Tests() {
  const results = [];
  if (!(await serverUp())) return 1;

  try {
    const r = await req("GET", "/dashboard");
    r.status === 200 ? ok(results, "dashboard") : err(results, "dashboard", `got ${r.status}`);
  } catch (e) {
    err(results, "dashboard", "add app/dashboard/");
  }

  try {
    const r = await req("POST", "/api/core/simulate-dispute", { body: { orderId: "1", reason: "t", amount: 1 } });
    r.status < 500 ? ok(results, "simulate-contract") : err(results, "simulate-contract", String(r.status));
  } catch (e) {
    err(results, "simulate-contract", e.message);
  }

  return done(results, "P4");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("test-p4.mjs");
if (isMain) runP4Tests().then((c) => process.exit(c));
