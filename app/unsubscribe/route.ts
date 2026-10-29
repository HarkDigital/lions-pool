// "Turn off reminders", from the footer of a pick-reminder email. Public (no
// sign-in) and signed: the link carries the account id plus an HMAC of it,
// so nobody can switch off somebody else's reminders.
//
//   GET   a confirm page with one button. Opening the link changes nothing:
//         mail scanners follow links, and they must never unsubscribe anyone.
//   POST  turns reminders off. The confirm button posts here, and so does a
//         mail client's native one-click unsubscribe (RFC 8058).

import { dbSetReminderPref } from "@/lib/db";
import { SITE_URL, verifyUnsubToken } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function check(req: Request): { userId: string } | null {
  const secret = process.env.REMINDERS_SECRET;
  const params = new URL(req.url).searchParams;
  const userId = params.get("u") ?? "";
  const token = params.get("t") ?? "";
  if (!secret || !userId || !token || !verifyUnsubToken(userId, token, secret)) return null;
  return { userId };
}

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} · The Lions Pool</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;min-height:100svh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
    background:radial-gradient(1100px 500px at 50% -10%,rgba(0,118,182,.14),transparent 70%),#070b11;
    font-family:Barlow,system-ui,sans-serif;color:#b0b7bc;text-align:center}
  .card{width:100%;max-width:400px;background:#0d141d;border:1px solid rgba(0,118,182,.6);border-radius:16px;padding:28px 24px}
  .brand,h1{font-family:'Bebas Neue','Arial Narrow',sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.02em;color:#eef2f5;margin:0}
  .brand{font-size:22px;margin-bottom:18px}
  h1{font-size:36px;line-height:1}
  p{font-size:15px;line-height:1.55;margin:12px 0 0}
  button,.btn{display:inline-block;margin-top:20px;width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:0;
    background:#0076b6;color:#fff;font:700 15px Barlow,system-ui,sans-serif;text-decoration:none;cursor:pointer}
  button:hover,.btn:hover{background:#005a8c}
  .fine{font-size:12px;color:#78838d;margin-top:14px}
  a{color:#38a8e8}
</style></head>
<body><main class="card"><div class="brand">The Lions Pool</div>${body}</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

const BAD_LINK = () =>
  page(
    "Link expired",
    `<h1>That link doesn't work</h1>
     <p>You can turn pick reminders on or off anytime on <a href="${SITE_URL}/my-picks/">My Picks</a>.</p>`,
    400,
  );

export async function GET(req: Request) {
  if (!check(req)) return BAD_LINK();
  return page(
    "Turn off reminders",
    `<h1>Turn off pick reminders?</h1>
     <p>You'll stop getting the email 24 hours before picks lock.</p>
     <form method="post"><button type="submit">Turn off reminders</button></form>
     <p class="fine">Changed your mind? Just close this page.</p>`,
  );
}

export async function POST(req: Request) {
  const ok = check(req);
  if (!ok) return BAD_LINK();
  // Only a real Clerk id writes; the ?test= sample's link lands here harmlessly.
  if (/^user_[A-Za-z0-9]+$/.test(ok.userId)) await dbSetReminderPref(ok.userId, false);
  return page(
    "Reminders off",
    `<h1>Reminders off</h1>
     <p>No more pick reminders. Want them back? Turn them on anytime on My Picks.</p>
     <a class="btn" href="${SITE_URL}/my-picks/">Go to My Picks</a>`,
  );
}
