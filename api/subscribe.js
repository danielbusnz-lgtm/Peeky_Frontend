// Signup endpoint. No storage — just emails NOTIFY_TO via Resend whenever
// someone submits the "notify me" form. Needs RESEND_API_KEY set in the
// project's environment variables.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTIFY_TO = "danielbusnz@gmail.com";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "method not allowed" });
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "invalid email" });
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.error("[subscribe] RESEND_API_KEY not set");
        return res.status(500).json({ error: "email not configured" });
    }

    try {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Peeky <onboarding@resend.dev>",
                to: NOTIFY_TO,
                subject: "New Peeky signup",
                text: `${email} wants to be notified when Peeky reaches their platform.`,
            }),
        });
        if (!r.ok) {
            console.error("[subscribe] resend failed:", await r.text());
            return res.status(502).json({ error: "send failed" });
        }
        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error("[subscribe] error:", e);
        return res.status(502).json({ error: "send failed" });
    }
}
