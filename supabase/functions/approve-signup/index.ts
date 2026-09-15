// Edge Function: approve-signup
// Called by the Approve / Reject links in the notify-signup email (plain GET
// from a mail client). Looks the one-time token up in signup_approvals and
// confirms or deletes the auth user with the service role. Renders a small
// HTML page so the approver sees the result in their browser.
//
// Deploy:  supabase functions deploy approve-signup --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, body: string, ok = true) {
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#F5F7FA;margin:0;padding:40px 20px;color:#1A1A1A}
.card{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.06)}
h1{font-size:20px;margin:12px 0;color:${ok ? '#2B588A' : '#DC2626'}} p{color:#555;line-height:1.5}</style></head>
<body><div class="card"><div style="font-size:44px">${ok ? '✅' : '⚠️'}</div><h1>${title}</h1><p>${body}</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const action = url.searchParams.get('action');
  if (!UUID.test(token) || (action !== 'approve' && action !== 'reject')) {
    return page('잘못된 링크', '링크가 올바르지 않습니다. 메일의 버튼을 다시 눌러 주세요.', false);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: row } = await supabase
    .from('signup_approvals')
    .select('user_id, email, full_name, decided_at, decision, decided_by')
    .eq('token', token)
    .maybeSingle();

  if (!row) return page('링크를 찾을 수 없습니다', '이미 처리되어 삭제된 신청이거나 링크가 만료되었습니다.', false);

  const who = row.full_name ? `${row.full_name} (${row.email ?? ''})` : (row.email ?? '');

  if (row.decided_at) {
    const by = row.decided_by === 'app' ? '앱에서' : '이메일로';
    return page(
      row.decision === 'approved' ? '이미 승인된 신청입니다' : '이미 거절된 신청입니다',
      `${who} — ${by} 먼저 처리되었습니다. 추가로 할 일은 없습니다.`,
    );
  }

  if (action === 'approve') {
    const { error } = await supabase.auth.admin.updateUserById(row.user_id, { email_confirm: true });
    if (error) return page('승인 실패', error.message, false);
    await supabase.from('signup_approvals')
      .update({ decided_at: new Date().toISOString(), decision: 'approved', decided_by: 'email' })
      .eq('user_id', row.user_id);
    return page('승인 완료', `${who} 님이 이제 앱에 로그인할 수 있습니다.`);
  }

  // reject → delete the unconfirmed auth user (signup_approvals row cascades)
  const { error } = await supabase.auth.admin.deleteUser(row.user_id);
  if (error) return page('거절 실패', error.message, false);
  return page('거절 처리 완료', `${who} 님의 가입 신청을 삭제했습니다. 필요하면 나중에 다시 가입할 수 있습니다.`);
});
