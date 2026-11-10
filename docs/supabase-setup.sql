-- À coller dans Supabase : SQL Editor → New query → Run (une seule fois).

-- 1. Table des pièces : une ligne par pièce, chaque utilisateur ne voit que les siennes.
create table if not exists public.pieces (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists pieces_user_updated_idx on public.pieces (user_id, updated_at);

alter table public.pieces enable row level security;

drop policy if exists "pieces_select_own" on public.pieces;
drop policy if exists "pieces_insert_own" on public.pieces;
drop policy if exists "pieces_update_own" on public.pieces;
drop policy if exists "pieces_delete_own" on public.pieces;
create policy "pieces_select_own" on public.pieces for select using (user_id = auth.uid());
create policy "pieces_insert_own" on public.pieces for insert with check (user_id = auth.uid());
create policy "pieces_update_own" on public.pieces for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pieces_delete_own" on public.pieces for delete using (user_id = auth.uid());

-- 2. Horodatage fait par le serveur à chaque écriture (sert à la synchronisation).
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end $$;

drop trigger if exists pieces_touch on public.pieces;
create trigger pieces_touch before insert or update on public.pieces
  for each row execute function public.touch_updated_at();

-- 3. Mises à jour en direct entre appareils.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pieces') then
    alter publication supabase_realtime add table public.pieces;
  end if;
end $$;

-- 4. Photos : dossier privé, chaque utilisateur accède uniquement à son propre dossier.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;

drop policy if exists "photos_select_own" on storage.objects;
drop policy if exists "photos_insert_own" on storage.objects;
drop policy if exists "photos_update_own" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
