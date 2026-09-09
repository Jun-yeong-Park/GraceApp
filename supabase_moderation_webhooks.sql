-- ============================================================================
-- Grace Church App — moderation webhooks (Apple Guideline 1.2)
-- Run in Supabase SQL Editor AFTER supabase_apple_1_2_compliance.sql and after
-- the notify-report / notify-block Edge Functions are deployed.
--
-- This replaces the Dashboard's "Database Webhooks" UI. That UI depends on the
-- `supabase_functions` schema, which only exists once webhooks have been enabled
-- from the Dashboard at least once. Calling pg_net directly avoids that
-- dependency and produces the exact same POST body the Edge Functions parse.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create extension if not exists pg_net;

create or replace function public.notify_moderation_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  fn_url text;
begin
  if tg_table_name = 'content_reports' then
    fn_url := 'https://epgwwsixhgdagavnurog.supabase.co/functions/v1/notify-report';
  elsif tg_table_name = 'blocked_users' then
    fn_url := 'https://epgwwsixhgdagavnurog.supabase.co/functions/v1/notify-block';
  else
    return new;
  end if;

  -- Mirrors the Supabase Database Webhook payload shape that the Edge Functions
  -- expect (see supabase/functions/notify-report/index.ts → WebhookPayload).
  -- net.http_post queues the request, so the INSERT is never blocked by it.
  perform net.http_post(
    url     := fn_url,
    body    := jsonb_build_object(
                 'type',       'INSERT',
                 'table',      tg_table_name,
                 'schema',     tg_table_schema,
                 'record',     to_jsonb(new),
                 'old_record', null
               ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists notify_report_on_insert on public.content_reports;
create trigger notify_report_on_insert
  after insert on public.content_reports
  for each row execute function public.notify_moderation_webhook();

drop trigger if exists notify_block_on_insert on public.blocked_users;
create trigger notify_block_on_insert
  after insert on public.blocked_users
  for each row execute function public.notify_moderation_webhook();
