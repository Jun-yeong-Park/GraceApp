// Minimal Resend wrapper used by notify-report / notify-block Edge Functions.
// Requires env var RESEND_API_KEY (set via `supabase secrets set RESEND_API_KEY=...`).

const RESEND_API = 'https://api.resend.com/emails';

// Until you verify a sending domain in Resend, use the sandbox sender.
// Sandbox sender can only deliver to the address that owns the Resend account.
const SENDER = 'Grace Church Moderation <onboarding@resend.dev>';

export async function sendModerationEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { ok: false, status: 500, body: 'RESEND_API_KEY not set' };
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SENDER,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
