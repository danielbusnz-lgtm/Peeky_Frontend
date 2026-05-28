// Print the waitlist from Upstash Redis, oldest signup first.
//
// Run with: npm run emails
//
// Reads KV_REST_API_URL / KV_REST_API_TOKEN from .env.local. Node does not
// auto-load that file (only Next.js does), and it is gitignored, so run
// `vercel env pull .env.local` first if it is missing.

import { Redis } from "@upstash/redis";
import { readFileSync } from "node:fs";

function loadEnv() {
    let text;
    try {
        text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    } catch {
        console.error("No .env.local found. Run: vercel env pull .env.local");
        process.exit(1);
    }
    for (const line of text.split("\n")) {
        const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
        if (m) process.env[m[1]] = m[2];
    }
}

loadEnv();

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

// withScores returns a flat [member, score, member, score, ...] array.
const rows = await redis.zrange("waitlist", 0, -1, { withScores: true });
const count = rows.length / 2;

console.log(`${count} ${count === 1 ? "signup" : "signups"}\n`);
for (let i = 0; i < rows.length; i += 2) {
    const when = new Date(Number(rows[i + 1])).toISOString().replace("T", " ").slice(0, 16);
    console.log(`  ${when}  ${rows[i]}`);
}
