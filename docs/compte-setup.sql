-- Suppression de compte depuis l'appli (Réglages, Mon compte et mes données, Supprimer mon compte).
-- À coller dans Supabase (SQL Editor) puis « Run ». Sans danger si tu le lances deux fois.
--
-- Ce que fait la fonction, pour la personne connectée UNIQUEMENT :
--   1. supprime ses lignes dans chaque table de Max (pièces, mesures d'usage, notifications, classement) ;
--   2. supprime son compte (auth.users).
-- Ses photos sont supprimées par l'appli avant l'appel (l'API de stockage de Supabase est la bonne méthode pour supprimer des fichiers) ;
-- par sécurité, les lignes de stockage qui resteraient sont aussi retirées ici.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth, storage as $$
declare
  uid uuid := auth.uid();
  t text;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  -- Chaque table est vidée seulement si elle existe : le script marche quelle que soit la liste des scripts déjà lancés.
  foreach t in array array['pieces', 'usage_daily', 'push_subscriptions', 'push_queue', 'amis_scores', 'amis_membres', 'app_admins'] loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('delete from public.%I where user_id = $1', t) using uid;
      exception when others then
        null; -- une table au schéma différent ne doit pas empêcher la suppression du compte
      end;
    end if;
  end loop;

  begin
    delete from storage.objects where bucket_id = 'photos' and (storage.foldername(name))[1] = uid::text;
  exception when others then
    null;
  end;

  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
