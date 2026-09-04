// Edge Function: notify-block
// Trigger: Supabase Database Webhook on INSERT into public.blocked_users
// Action:  emails the developer (Apple UGC guideline explicitly requires
//          that blocking a user notifies the developer).
//
// Deploy:
//   supabase functions deploy notify-block --no-verify-jwt
// Set the webhook in Dashboard → Database → Webhooks → New:
//   Table: blocked_users, Events: Insert, HTTP: POST, URL: <edge fn URL>

import { sendModerationEmail, escapeHtml } from '../_shared/send-email.ts';

const DEVELOPER_EMAIL = 'junyeongpark96@gmail.com';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload.type !== 'INSERT' || !payload.record) {
    return new Response('Ignored', { status: 200 });
  }

  const r = payload.record;
  const html = `
    <h2>🚫 User Block Event — Grace Church App</h2>
    <p>A user has blocked another user. Apple UGC guideline requires that blocking notifies the developer.</p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px;color:#666">Block ID</td><td style="padding:4px 12px"><code>${escapeHtml(r.id)}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Blocker</td><td style="padding:4px 12px"><code>${escapeHtml(r.blocker_id)}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Blocked user</td><td style="padding:4px 12px"><code>${escapeHtml(r.blocked_id)}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Timestamp</td><td style="padding:4px 12px">${escapeHtml(r.created_at)}</td></tr>
    </table>
    <p style="margin-top:20px">
      If the blocked user has multiple block events or content reports, consider banning them via Admin → Moderation.
    </p>
  `;

  const result = await sendModerationEmail({
    to: DEVELOPER_EMAIL,
    subject: `🚫 [Grace Church] User block event`,
    html,
  });

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
