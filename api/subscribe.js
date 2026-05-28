// Waitlist signup endpoint. Stores each email once in an Upstash Redis sorted
// set ("waitlist"), scored by signup time, so re-submitting an address is a
// no-op and the list reads back in signup order. The Vercel Upstash
// integration injects KV_REST_API_URL / KV_REST_API_TOKEN (not the
// UPSTASH_-prefixed names Redis.fromEnv() expects), so wire them explicitly.

import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

// Pragmatic check: one @, a dot in the domain, no spaces. Not RFC-complete,
// just enough to reject junk before it hits the store.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "method not allowed" });
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "invalid email" });
    }

    try {
        await redis.zadd("waitlist", { score: Date.now(), member: email });
        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error("[subscribe] zadd failed:", e);
        return res.status(502).json({ error: "storage write failed" });
    }
}
