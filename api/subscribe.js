// Waitlist signup endpoint. Stores each email once in an Upstash Redis sorted
// set ("waitlist"), scored by signup time, so re-submitting an address is a
// no-op and the list reads back in signup order. The Vercel Upstash
// integration injects KV_REST_API_URL / KV_REST_API_TOKEN (not the
// UPSTASH_-prefixed names Redis.fromEnv() expects), so wire them explicitly.
//
// On a first-time signup it also emails NOTIFY_TO via Resend (best effort).

import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

// Pragmatic check: one @, a dot in the domain, no spaces. Not RFC-complete,
// just enough to reject junk before it hits the store.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where signup notifications go.
const NOTIFY_TO = "danielbusnz@gmail.com";

// Email the owner when a new address joins. Best effort: a missing key or a
// failed send never blocks the signup. Resend REST API directly, no SDK.
async function notify(email) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return;
    try {
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Aegis Waitlist <onboarding@resend.dev>",
                to: NOTIFY_TO,
                subject: "New Aegis signup",
                text: `${email} just joined the waitlist.`,
            }),
        });
    } catch (e) {
        console.error("[subscribe] notify failed:", e);
    }
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "method not allowed" });
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "invalid email" });
    }

    try {
        // zadd returns the count of NEW members, so a re-submit (count 0) does
        // not re-notify.
        const added = await redis.zadd("waitlist", { score: Date.now(), member: email });
        if (added > 0) {
            await notify(email);
        }
        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error("[subscribe] zadd failed:", e);
        return res.status(502).json({ error: "storage write failed" });
    }
}
