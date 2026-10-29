import "server-only";

// Outbound email through SendGrid's v3 API (plain fetch, no SDK). The key
// lives in the VPS .env as SENDGRID_API_KEY; thelionspool.com must be an
// authenticated sending domain in that SendGrid account or every send 403s.

const FROM = { email: "picks@thelionspool.com", name: "The Lions Pool" };
const REPLY_TO = { email: "thelionspool@gmail.com", name: "Mother Superior" };

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One-click unsubscribe target (RFC 8058), shown by Gmail, Yahoo, Apple Mail. */
  unsubscribeUrl: string;
  category: string;
}

export async function sendEmail(
  msg: OutboundEmail,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { ok: false, error: "SENDGRID_API_KEY is not set" };
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: FROM,
        reply_to: REPLY_TO,
        subject: msg.subject,
        content: [
          { type: "text/plain", value: msg.text },
          { type: "text/html", value: msg.html },
        ],
        headers: {
          "List-Unsubscribe": `<${msg.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        categories: [msg.category],
        // No link rewriting or tracking pixel: the links stay exactly as
        // written, which keeps the one-click unsubscribe link intact.
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
        },
      }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
