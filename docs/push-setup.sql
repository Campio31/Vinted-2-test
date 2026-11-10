-- Notifications push (appli fermée).
-- À coller dans Supabase : SQL Editor → New query → Run (une seule fois, peut être relancé sans risque).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Appareils abonnés (un téléphone ou un PC = une ligne). Chacun ne voit que les siens.
create table if not exists public.push_subscriptions (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subs_select_own" on public.push_subscriptions;
drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
drop policy if exists "push_subs_update_own" on public.push_subscriptions;
drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
create policy "push_subs_select_own" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push_subs_insert_own" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push_subs_update_own" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subs_delete_own" on public.push_subscriptions for delete using (user_id = auth.uid());

-- 2. File des notifications à envoyer : l'appli y dépose les rappels calculés (colis, live, calendrier commercial).
create table if not exists public.push_queue (
  user_id uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  tag     text        not null,
  send_at timestamptz not null,
  title   text        not null default 'Max',
  body    text        not null,
  sent    boolean     not null default false,
  primary key (user_id, tag)
);
create index if not exists push_queue_due_idx on public.push_queue (send_at) where not sent;
alter table public.push_queue enable row level security;
drop policy if exists "push_queue_select_own" on public.push_queue;
drop policy if exists "push_queue_insert_own" on public.push_queue;
drop policy if exists "push_queue_update_own" on public.push_queue;
drop policy if exists "push_queue_delete_own" on public.push_queue;
create policy "push_queue_select_own" on public.push_queue for select using (user_id = auth.uid());
create policy "push_queue_insert_own" on public.push_queue for insert with check (user_id = auth.uid());
create policy "push_queue_update_own" on public.push_queue for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_queue_delete_own" on public.push_queue for delete using (user_id = auth.uid());

-- 3. Remplace d'un coup les rappels à venir de l'utilisateur (appelée par l'appli à chaque changement).
create or replace function public.set_push_schedule(items jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  delete from push_queue
   where user_id = auth.uid() and not sent and tag not like 'test:%'
     and tag not in (select x->>'tag' from jsonb_array_elements(items) x);
  insert into push_queue (user_id, tag, send_at, title, body)
  select auth.uid(), x->>'tag', (x->>'send_at')::timestamptz, coalesce(x->>'title', 'Max'), x->>'body'
    from jsonb_array_elements(items) x
  on conflict (user_id, tag) do update
    set send_at = excluded.send_at, title = excluded.title, body = excluded.body
    where not push_queue.sent;
end $$;

-- 4. Mot de passe interne entre la tâche planifiée et la fonction d'envoi (généré ici, jamais affiché ni copié).
create table if not exists public.push_config (
  id     int  primary key default 1 check (id = 1),
  secret text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
alter table public.push_config enable row level security;   -- aucune règle = personne côté appli
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (id) values (1) on conflict (id) do nothing;

-- 5. Tâche planifiée : chaque minute, s'il y a des rappels dus, appelle la fonction « envoyer-rappels ».
select cron.unschedule(jobid) from cron.job where jobname in ('max-push', 'max-push-nettoyage');

select cron.schedule('max-push', '* * * * *', $$
  select net.http_post(
    url     := 'https://akbwyxbllrfeibmtwdbh.supabase.co/functions/v1/envoyer-rappels',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select secret from public.push_config where id = 1)),
    body    := '{}'::jsonb
  )
  where exists (select 1 from public.push_queue where not sent and send_at <= now());
$$);

-- Nettoyage quotidien des rappels déjà envoyés.
select cron.schedule('max-push-nettoyage', '15 3 * * *', $$
  delete from public.push_queue where sent and send_at < now() - interval '7 days';
$$);
