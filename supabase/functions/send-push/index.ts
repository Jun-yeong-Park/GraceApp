// Edge Function: send-push
// Trigger: pg_net trigger (notify_push_webhook) on INSERT into
//          public.announcements or public.events — see supabase_functional_fixes.sql
// Action:  fans the new item out to every registered device via Expo's push API.
//
// Deploy:
//   supabase functions deploy send-push --no-verify-jwt
//
// Uses SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which Supabase injects into
// every Edge Function automatically — no extra secrets needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
}

type Lang = 'ko' | 'en' | 'es';

function pick(r: Record<string, unknown>, base: string, lang: Lang): string {
  const v = (r[`${base}_${lang}`] ?? r[`${base}_ko`] ?? r[`${base}_en`] ?? r[base]) as string | undefined;
  return (v ?? '').toString().trim();
}

function buildMessage(table: string, r: Record<string, unknown>, lang: Lang): { title: string; body: string } {
  if (table === 'announcements') {
    const heading = { ko: '📢 새 공지', en: '📢 New announcement', es: '📢 Nuevo aviso' }[lang];
    const title = pick(r, 'title', lang);
    const body = pick(r, 'body', lang);
    return { title: title ? `${heading}: ${title}` : heading, body: body.slice(0, 160) };
  }
  // events
  const heading = { ko: '📅 새 일정', en: '📅 New event', es: '📅 Nuevo evento' }[lang];
  const title = (r.title as string | undefined) ?? '';
  const when = [r.date, r.time].filter(Boolean).join(' ');
  const where = (r.location as string | undefined) ?? '';
  const body = [when, where].filter(Boolean).join(' · ');
  return { title: title ? `${heading}: ${title}` : heading, body };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let payload: WebhookPayload;
  try { payload = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (payload.type !== 'INSERT' || !payload.record) return new Response('Ignored', { status: 200 });
  if (payload.table !== 'announcements' && payload.table !== 'events') return new Response('Ignored', { status: 200 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: tokens, error } = await supabase.from('push_tokens').select('token, lang');
  if (error) return new Response(`push_tokens read failed: ${error.message}`, { status: 500 });
  if (!tokens || tokens.length === 0) return new Response('No devices', { status: 200 });

  // Expo accepts up to 100 messages per request.
  const messages = tokens
    .filter((t) => typeof t.token === 'string' && t.token.startsWith('ExponentPushToken['))
    .map((t) => {
      const lang: Lang = (['ko', 'en', 'es'] as Lang[]).includes(t.lang as Lang) ? (t.lang as Lang) : 'en';
      const { title, body } = buildMessage(payload.table, payload.record!, lang);
      return { to: t.token, sound: 'default', title, body, data: { table: payload.table, id: payload.record!.id } };
    });

  const results: unknown[] = [];
  const stale: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => ({}));
    results.push(json);
    // Drop tokens Expo says are no longer registered so we stop sending to them.
    const tickets = (json as { data?: Array<{ status: string; details?: { error?: string } }> }).data ?? [];
    tickets.forEach((tk, idx) => {
      if (tk.status === 'error' && tk.details?.error === 'DeviceNotRegistered') stale.push(chunk[idx].to);
    });
  }
  if (stale.length > 0) await supabase.from('push_tokens').delete().in('token', stale);

  return new Response(JSON.stringify({ sent: messages.length, removedStale: stale.length, results }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
