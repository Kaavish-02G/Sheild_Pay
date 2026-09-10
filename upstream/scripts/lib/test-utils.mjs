/** Minimal test harness — OK/ERR lines only. */
import "./env.mjs";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const MONGO = process.env.MONGODB_URI ?? "mongodb://localhost:27017/shieldpay";
const PREFIX = "p1-test-";

export const cfg = { BASE, MONGO, PREFIX };

export function ok(results, name) {
  results.push(true);
  console.log(`OK ${name}`);
}

export function err(results, name, why) {
  results.push(false);
  console.log(`ERR ${name} ${why}`);
}

export function done(results, label) {
  const n = results.filter(Boolean).length;
  const f = results.length - n;
  console.log(`${label}: ${n}/${results.length}${f ? ` (${f} failed)` : ""}`);
  return f ? 1 : 0;
}

export async function req(method, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body !== undefined
      ? typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)
      : undefined,
  });
  let json;
  try { json = JSON.parse(await res.text()); } catch { json = null; }
  return { status: res.status, json };
}

export async function connect() {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(MONGO);
  await client.connect();
  return { client, db: client.db() };
}

/** Remove p1-test-* rows so runs are deterministic. */
export async function cleanup() {
  const { client, db } = await connect();
  await db.collection("disputes").deleteMany({ disputeId: { $regex: `^${PREFIX}` } });
  await db.collection("merchants").deleteMany({ shopDomain: { $regex: `^${PREFIX}` } });
  await client.close();
}

export async function serverUp() {
  try {
    await fetch(BASE);
    return true;
  } catch {
    console.log(`ERR setup start npm run dev (${BASE})`);
    return false;
  }
}

export async function mongoUp() {
  try {
    const { client } = await connect();
    await client.close();
    return true;
  } catch {
    console.log(`ERR setup MongoDB unreachable (${MONGO})`);
    return false;
  }
}
