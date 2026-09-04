// Edge Function: notify-report
// Trigger: Supabase Database Webhook on INSERT into public.content_reports
// Action:  emails the developer so a report can be reviewed within 24h.
//
// Deploy:
//   supabase functions deploy notify-report --no-verify-jwt
// Set the webhook in Dashboard → Database → Webhooks → New:
//   Table: content_reports, Events: Insert, HTTP: POST, URL: <edge fn URL>

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
    <h2>🚨 New Content Report — Grace Church App</h2>
    <p>A user has submitted a report. Please review within 24 hours per Apple UGC policy.</p>
    <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px;color:#666">Report ID</td><td style="padding:4px 12px"><code>${escapeHtml(r.id)}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Reporter</td><td style="padding:4px 12px"><code>${escapeHtml(r.reporter_id)}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Content type</td><td style="padding:4px 12px"><b>${escapeHtml(r.content_type)}</b></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Content ID</td><td style="padding:4px 12px"><code>${escapeHtml(r.content_id)}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Reported user</td><td style="padding:4px 12px"><code>${escapeHtml(r.reported_user_id ?? '(unknown)')}</code></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Reason</td><td style="padding:4px 12px"><b>${escapeHtml(r.reason)}</b></td></tr>
      <tr><td style="padding:4px 12px;color:#666">Submitted</td><td style="padding:4px 12px">${escapeHtml(r.created_at)}</td></tr>
    </table>
    <p style="margin-top:20px">
      Open the app's Admin → Moderation tab to review, remove content, or ban the user.
    </p>
  `;

  const result = await sendModerationEmail({
    to: DEVELOPER_EMAIL,
    subject: `🚨 [Grace Church] New ${r.content_type} report — reason: ${r.reason}`,
    html,
  });

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
