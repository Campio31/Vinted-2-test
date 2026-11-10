-- Classement entre amis revendeurs (défis du mois).
-- À coller dans Supabase : SQL Editor → New query → Run (une seule fois, peut être relancé sans risque).
-- Principe : chacun publie seulement 2 chiffres par mois (pièces publiées, ventes) et un pseudo.
-- On ne lit les chiffres des autres que par la fonction « classement », limitée aux groupes dont on fait partie.

create table if not exists public.amis_groupes (
  id         uuid        primary key default gen_random_uuid(),
  code       text        not null unique,
  nom        text        not null,
  created_by uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.amis_membres (
  groupe_id uuid        not null references public.amis_groupes(id) on delete cascade,
  user_id   uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  pseudo    text        not null check (char_length(pseudo) between 1 and 24),
  joined_at timestamptz not null default now(),
  primary key (groupe_id, user_id)
);
create table if not exists public.amis_scores (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  mois       text        not null check (mois ~ '^\d{4}-\d{2}$'),
  pubs       int         not null default 0 check (pubs between 0 and 100000),
  ventes     int         not null default 0 check (ventes between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, mois)
);

-- Liste des groupes de l'utilisateur (security definer : évite qu'une règle se rappelle elle-même).
create or replace function public.mes_groupes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select groupe_id from amis_membres where user_id = auth.uid()
$$;

alter table public.amis_groupes enable row level security;
alter table public.amis_membres enable row level security;
alter table public.amis_scores  enable row level security;

drop policy if exists "amis_groupes_select" on public.amis_groupes;
drop policy if exists "amis_membres_select" on public.amis_membres;
drop policy if exists "amis_membres_update" on public.amis_membres;
drop policy if exists "amis_membres_delete" on public.amis_membres;
drop policy if exists "amis_scores_select"  on public.amis_scores;
drop policy if exists "amis_scores_insert"  on public.amis_scores;
drop policy if exists "amis_scores_update"  on public.amis_scores;
drop policy if exists "amis_scores_delete"  on public.amis_scores;

-- Groupes et membres : visibles seulement pour les membres du groupe. Créer / rejoindre passe par les fonctions ci-dessous.
create policy "amis_groupes_select" on public.amis_groupes for select using (id in (select public.mes_groupes()));
create policy "amis_membres_select" on public.amis_membres for select using (groupe_id in (select public.mes_groupes()));
create policy "amis_membres_update" on public.amis_membres for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "amis_membres_delete" on public.amis_membres for delete using (user_id = auth.uid());

-- Scores : chacun lit et écrit uniquement les siens (les autres ne se lisent que via « classement »).
create policy "amis_scores_select" on public.amis_scores for select using (user_id = auth.uid());
create policy "amis_scores_insert" on public.amis_scores for insert with check (user_id = auth.uid());
create policy "amis_scores_update" on public.amis_scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "amis_scores_delete" on public.amis_scores for delete using (user_id = auth.uid());

create or replace function public.amis_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists amis_scores_touch on public.amis_scores;
create trigger amis_scores_touch before insert or update on public.amis_scores
  for each row execute function public.amis_touch();

-- Créer un groupe : renvoie son code d'invitation (6 caractères, sans 0/O/1/I).
create or replace function public.creer_groupe(p_nom text, p_pseudo text) returns json
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text; g uuid; i int;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if char_length(trim(coalesce(p_nom, ''))) = 0 then raise exception 'Donne un nom au groupe.'; end if;
  if char_length(trim(coalesce(p_pseudo, ''))) = 0 then raise exception 'Choisis un pseudo.'; end if;
  if (select count(*) from amis_membres where user_id = auth.uid()) >= 10 then raise exception 'Tu es déjà dans 10 groupes.'; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from amis_groupes where code = c);
  end loop;
  insert into amis_groupes (code, nom) values (c, left(trim(p_nom), 40)) returning id into g;
  insert into amis_membres (groupe_id, user_id, pseudo) values (g, auth.uid(), left(trim(p_pseudo), 24));
  return json_build_object('id', g, 'code', c);
end $$;

-- Rejoindre un groupe avec son code.
create or replace function public.rejoindre_groupe(p_code text, p_pseudo text) returns json
language plpgsql security definer set search_path = public as $$
declare g amis_groupes;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if char_length(trim(coalesce(p_pseudo, ''))) = 0 then raise exception 'Choisis un pseudo.'; end if;
  select * into g from amis_groupes where code = upper(trim(p_code));
  if not found then raise exception 'Code inconnu.'; end if;
  if (select count(*) from amis_membres where groupe_id = g.id) >= 30 and
     not exists (select 1 from amis_membres where groupe_id = g.id and user_id = auth.uid()) then
    raise exception 'Ce groupe est complet (30 membres).';
  end if;
  insert into amis_membres (groupe_id, user_id, pseudo) values (g.id, auth.uid(), left(trim(p_pseudo), 24))
    on conflict (groupe_id, user_id) do update set pseudo = excluded.pseudo;
  return json_build_object('id', g.id, 'code', g.code);
end $$;

-- Classement d'un groupe pour un mois ('2026-10'), réservé à ses membres.
create or replace function public.classement(p_groupe uuid, p_mois text)
returns table (pseudo text, pubs int, ventes int, moi boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from amis_membres where groupe_id = p_groupe and user_id = auth.uid()) then
    raise exception 'Tu ne fais pas partie de ce groupe.';
  end if;
  return query
    select m.pseudo, coalesce(s.pubs, 0), coalesce(s.ventes, 0), (m.user_id = auth.uid())
      from amis_membres m left join amis_scores s on s.user_id = m.user_id and s.mois = p_mois
     where m.groupe_id = p_groupe
     order by coalesce(s.ventes, 0) desc, coalesce(s.pubs, 0) desc, m.pseudo;
end $$;

revoke all on function public.creer_groupe(text, text), public.rejoindre_groupe(text, text), public.classement(uuid, text), public.mes_groupes() from public, anon;
grant execute on function public.creer_groupe(text, text), public.rejoindre_groupe(text, text), public.classement(uuid, text), public.mes_groupes() to authenticated;
