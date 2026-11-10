-- Page d'administration de Max : à coller dans Supabase (SQL Editor) puis « Run ».
-- Sans danger si tu le lances deux fois.
--
-- AVANT DE LANCER : remplace TON_EMAIL@exemple.com (tout en bas) par l'e-mail de ton compte Max.

-- 1) Mesures d'usage : uniquement des COMPTEURS par compte, par jour et par nom d'écran ou d'outil.
--    Jamais le contenu du stock, des ventes, des pseudos ou des prix.
create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  name    text not null check (name ~ '^[a-z0-9_:.-]{1,40}$'),
  n       integer not null default 0,
  primary key (user_id, day, name)
);
create index if not exists usage_daily_day_idx on public.usage_daily (day);
alter table public.usage_daily enable row level security;
-- Aucune règle d'accès : personne ne lit ni n'écrit la table directement. Tout passe par les fonctions ci-dessous.
revoke all on public.usage_daily from anon, authenticated;

-- 2) La liste des administrateurs (toi seulement).
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

-- 3) « Suis-je administrateur ? »
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- 4) L'appli envoie ses compteurs (appelée par chaque utilisateur connecté, pour lui-même uniquement).
create or replace function public.track_usage(p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  e jsonb; v_day date; v_name text; v_n integer; v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(p_events) <> 'array' then return; end if;
  for e in select * from jsonb_array_elements(p_events) loop
    v_count := v_count + 1;
    exit when v_count > 60;
    v_name := lower(coalesce(e->>'k', ''));
    continue when v_name !~ '^[a-z0-9_:.-]{1,40}$';
    begin v_day := (e->>'d')::date; exception when others then v_day := current_date; end;
    if v_day is null or v_day < current_date - 7 or v_day > current_date + 1 then v_day := current_date; end if;
    v_n := greatest(1, least(coalesce((e->>'n')::integer, 1), 1000));
    insert into public.usage_daily (user_id, day, name, n) values (auth.uid(), v_day, v_name, v_n)
    on conflict (user_id, day, name) do update set n = public.usage_daily.n + excluded.n;
  end loop;
end $$;

-- 5) Les chiffres de la page d'administration. Refusé à quiconque n'est pas dans app_admins.
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'generated', now(),
    'users_total',      (select count(*) from auth.users),
    'users_confirmed',  (select count(*) from auth.users where email_confirmed_at is not null),
    'users_7d',         (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'users_30d',        (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'signups_by_day',   coalesce((select jsonb_agg(jsonb_build_object('d', g.d::date, 'n', coalesce(s.n, 0)) order by g.d)
                          from generate_series(current_date - 29, current_date, interval '1 day') as g(d)
                          left join (select created_at::date d, count(*) n from auth.users group by 1) s on s.d = g.d::date), '[]'::jsonb),
    'active_1d',        (select count(distinct user_id) from public.usage_daily where day = current_date),
    'active_7d',        (select count(distinct user_id) from public.usage_daily where day >= current_date - 6),
    'active_30d',       (select count(distinct user_id) from public.usage_daily where day >= current_date - 29),
    'active_by_day',    coalesce((select jsonb_agg(jsonb_build_object('d', g.d::date, 'n', coalesce(a.n, 0)) order by g.d)
                          from generate_series(current_date - 29, current_date, interval '1 day') as g(d)
                          left join (select day d, count(distinct user_id) n from public.usage_daily group by 1) a on a.d = g.d::date), '[]'::jsonb),
    'top_features',     coalesce((select jsonb_agg(x order by (x->>'uses')::int desc) from (
                          select jsonb_build_object('name', name, 'uses', sum(n), 'users', count(distinct user_id)) x
                          from public.usage_daily
                          where day >= current_date - 29 and name <> '_visite'
                          group by name order by sum(n) desc limit 25) q), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- 6) Droits : seuls les comptes connectés peuvent appeler ces fonctions (et admin_stats refuse les non-admins).
revoke all on function public.is_admin()        from public, anon;
revoke all on function public.track_usage(jsonb) from public, anon;
revoke all on function public.admin_stats()     from public, anon;
grant execute on function public.is_admin()        to authenticated;
grant execute on function public.track_usage(jsonb) to authenticated;
grant execute on function public.admin_stats()     to authenticated;

-- 7) TOI, administrateur. Remplace l'e-mail, puis lance. Si « 0 rows » s'affiche, l'e-mail ne correspond à aucun compte :
--    crée d'abord ton compte dans Max avec cet e-mail.
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = lower('thomasxavierdurand@gmail.com')
on conflict do nothing;
