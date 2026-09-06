import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const lines = readFileSync(join(root, ".env"), "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* optional .env */ }

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb://localhost:27017/shieldpay";
}

process.env.NODE_ENV ??= "test";

if (process.env.NODE_ENV === "test") {
  process.env.SKIP_P3_INVOKE ??= "true";
  process.env.SKIP_P4_AUTOMATION ??= "true";
}
