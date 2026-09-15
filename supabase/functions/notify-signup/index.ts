// Edge Function: notify-signup
// Trigger: pg_net trigger on INSERT into public.signup_approvals
//          (supabase_signup_approval.sql). Emails the approvers with one-click
//          Approve / Reject links. Either approver acting is enough.
//
// Deploy:  supabase functions deploy notify-signup --no-verify-jwt
//
// NOTE: Resend's sandbox sender (onboarding@resend.dev) only delivers to the
// Resend account owner's address. To reach every approver, verify the church
// domain in Resend and change SENDER in _shared/send-email.ts.

import { sendModerationEmail, escapeHtml } from '../_shared/send-email.ts';

const APPROVER_EMAILS = ['junyeongpark96@gmail.com', 'joccjosh@gmail.com'];
const APPROVE_FN = 'https://epgwwsixhgdagavnurog.supabase.co/functions/v1/approve-signup';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: { user_id: string; token: string; email: string | null; full_name: string | null; created_at: string } | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let payload: WebhookPayload;
  try { payload = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (payload.type !== 'INSERT' || !payload.record) return new Response('Ignored', { status: 200 });

  const r = payload.record;
  const approveUrl = `${APPROVE_FN}?token=${r.token}&action=approve`;
  const rejectUrl  = `${APPROVE_FN}?token=${r.token}&action=reject`;
  const name = escapeHtml(r.full_name ?? '(이름 없음)');
  const email = escapeHtml(r.email ?? '');
  const when = new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'America/New_York' });

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;max-width:520px">
      <h2 style="margin:0 0 12px">🙋 주은혜교회 앱 가입 신청</h2>
      <p>새로운 가입 신청이 들어왔습니다. 아래 버튼 하나만 누르면 처리됩니다 (두 분 중 한 분만 누르시면 됩니다).</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px;color:#666">이름</td><td style="padding:4px 12px"><b>${name}</b></td></tr>
        <tr><td style="padding:4px 12px;color:#666">이메일</td><td style="padding:4px 12px">${email}</td></tr>
        <tr><td style="padding:4px 12px;color:#666">신청 시각</td><td style="padding:4px 12px">${escapeHtml(when)} (Orlando)</td></tr>
      </table>
      <p style="margin:24px 0">
        <a href="${approveUrl}" style="background:#2B588A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;display:inline-block;margin-right:10px">✓ 승인</a>
        <a href="${rejectUrl}"  style="background:#fff;color:#DC2626;border:1.5px solid #DC2626;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;display:inline-block">거절</a>
      </p>
      <p style="color:#888;font-size:13px">승인하면 바로 로그인할 수 있습니다. 거절하면 신청이 삭제되고 나중에 다시 가입할 수 있습니다.<br>
      앱에서도 처리할 수 있습니다: More → Admin Dashboard → Approvals.</p>
    </div>`;

  const result = await sendModerationEmail({
    to: APPROVER_EMAILS,
    subject: `🙋 [주은혜교회 앱] 가입 승인 요청 — ${r.full_name ?? r.email ?? ''}`,
    html,
  });
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 502, headers: { 'Content-Type': 'application/json' } });
});
