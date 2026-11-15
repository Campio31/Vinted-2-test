// GET /live/oauth/:provider/callback — retour du consentement vendeur (SQUELETTE, non déployé, non testé).
// Règles de la spécification (section 4) :
//   - relier le consentement au vendeur Syno par `state` (usage unique, durée courte) ou par une session de connexion serveur à usage unique ;
//   - échanger le code CÔTÉ SERVEUR, puis VÉRIFIER l'identité réelle de la boutique avant d'enregistrer le compte ;
//   - ne jamais mettre le secret d'application, les jetons ou des données brutes de clients dans le front, IndexedDB ou localStorage ;
//   - ne pas demander noms, adresses ni portée « expédition » : la V1 ne sert qu'à suivre les ventes ;
//   - une boutique déjà revendiquée par un autre espace est refusée (pas de transfert sans procédure).
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const url = new URL(req.url), code = url.searchParams.get("code"), state = url.searchParams.get("state");
  if (!code || !state) return new Response("missing code or state", { status: 400 });

  // 1. retrouver et CONSOMMER le state (à créer : table live_oauth_states { state, tenant_id, provider, expires_at, used_at }).
  // 2. échanger le code contre un jeton auprès de la plateforme (URL et paramètres : documentation officielle du fournisseur).
  // 3. lire l'identité de la boutique avec ce jeton ; comparer au marché attendu (FR).
  // 4. stocker le jeton dans le coffre → provider_credentials.token_secret_ref ; créer provider_accounts avec les portées réellement accordées.
  // 5. mettre en file un job de rattrapage initial (sync_jobs) et rediriger vers l'application avec un message court.
  void db;
  return new Response("not implemented", { status: 501 });
});
