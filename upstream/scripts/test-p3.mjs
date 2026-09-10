import { ok, err, done, req, serverUp } from "./lib/test-utils.mjs";

function hasPackageShape(json) {
  return (
    json &&
    typeof json.disputeId === "string" &&
    typeof json.confidenceScore === "number" &&
    ["auto_submit", "review", "insufficient"].includes(json.status) &&
    json.evidence &&
    typeof json.evidence === "object" &&
    Array.isArray(json.ledger)
  );
}

export async function runP3Tests() {
  const results = [];
  if (!(await serverUp())) return 1;

  try {
    const r = await req("POST", "/api/p3/invoke", { body: { disputeId: "test-none" } });
    if (r.status >= 500) {
      err(results, "p3-invoke", String(r.status));
    } else if (!hasPackageShape(r.json)) {
      err(results, "p3-invoke", "response missing VerifiedEvidencePackage fields");
    } else {
      ok(results, "p3-invoke");
    }
  } catch (e) {
    err(results, "p3-invoke", "add app/api/p3/invoke/route.ts");
  }

  return done(results, "P3");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("test-p3.mjs");
if (isMain) runP3Tests().then((c) => process.exit(c));
