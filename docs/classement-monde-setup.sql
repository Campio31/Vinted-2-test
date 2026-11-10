-- Classement Monde et Régions (facultatif, sur les points du mois).
-- À coller dans Supabase : SQL Editor → New query → Run (une seule fois, peut être relancé sans risque).
-- Principe : chacun choisit de rejoindre. Seuls un pseudo, une région et les points du mois sont partagés, jamais les euros ni le stock.
-- Les autres ne se lisent que par la fonction « classement_public » (50 premiers + ta place).

create table if not exists public.profils_pub (
  user_id    uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  pseudo     text        not null check (char_length(pseudo) between 2 and 24),
  region     text        not null check (char_length(region) between 2 and 40),
  updated_at timestamptz not null default now()
);
create table if not exists public.scores_mois (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  mois       text        not null check (mois ~ '^\d{4}-\d{2}$'),
  points     int         not null default 0 check (points between 0 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, mois)
);

alter table public.profils_pub enable row level security;
alter table public.scores_mois enable row level security;

drop policy if exists "profils_pub_own" on public.profils_pub;
drop policy if exists "scores_mois_own" on public.scores_mois;
-- Chacun ne lit et n'écrit que ses propres lignes ; le classement passe par la fonction ci-dessous.
create policy "profils_pub_own" on public.profils_pub for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scores_mois_own" on public.scores_mois for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_rang() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profils_pub_touch on public.profils_pub;
create trigger profils_pub_touch before insert or update on public.profils_pub for each row execute function public.touch_rang();
drop trigger if exists scores_mois_touch on public.scores_mois;
create trigger scores_mois_touch before insert or update on public.scores_mois for each row execute function public.touch_rang();

-- Classement d'un mois ('2026-11'), pour tous (p_region null) ou pour une région. 50 premiers + la place de l'appelant.
create or replace function public.classement_public(p_mois text, p_region text default null)
returns table (rang bigint, pseudo text, region text, points int, moi boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  return query
    with t as (
      select p.user_id, p.pseudo, p.region, s.points,
             rank() over (order by s.points desc) as rg
        from profils_pub p
        join scores_mois s on s.user_id = p.user_id and s.mois = p_mois
       where s.points > 0 and (p_region is null or p.region = p_region)
    )
    select t.rg, t.pseudo, t.region, t.points, (t.user_id = auth.uid())
      from t
     where t.rg <= 50 or t.user_id = auth.uid()
     order by t.rg, t.pseudo;
end $$;

-- Quitter le classement : efface le profil public et les scores.
create or replace function public.quitter_classement() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  delete from scores_mois where user_id = auth.uid();
  delete from profils_pub where user_id = auth.uid();
end $$;

revoke all on function public.classement_public(text, text), public.quitter_classement() from public, anon;
grant execute on function public.classement_public(text, text), public.quitter_classement() to authenticated;