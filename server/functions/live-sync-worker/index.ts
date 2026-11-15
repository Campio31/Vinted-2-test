// Worker de synchronisation (SQUELETTE, non déployé, non testé) : traite les jobs, relit l'état COURANT chez la plateforme, normalise, applique.
//
//   notification → vérifier et enregistrer → job → relire l'état courant → normaliser commandes et lignes
//   → attribuer live et origine → enregistrer le delta de stock → rapprocher la finance → recalculer le bilan
//   + synchronisation périodique (rattrapage) qui converge même si une notification est perdue.
//
// Règles à respecter (spécification, section 3 « Stock, retours et résistance aux doublons ») :
//   - n'appliquer jamais un état plus ancien que celui déjà connu (provider_updated_at) ; résister à l'arrivée hors ordre ;
//   - effet cible MOINS effet déjà compté (line_stock_effects), dans une transaction qui verrouille la ligne et la variante ;
//   - curseur avec chevauchement et pagination ; ne JAMAIS avancer le curseur si une page échoue ;
//   - réessayer 429/5xx avec temporisation et aléa, respecter les limites du fournisseur ;
//   - jeton révoqué → provider_accounts.status = 'reconnect' et arrêt des traitements de ce compte ;
//   - une synchronisation en cours ne publie rien après une déconnexion ;
//   - une vente impossible n'est pas effacée : elle ouvre un écart de stock (le solde théorique peut être négatif) ;
//   - ne pas stocker les URL signées de rapports dans les journaux.
// La logique de référence, testée, est dans src/modules/live-core.js (ingestLines, recompute, ingestEntries) : la porter en SQL/TypeScript à l'identique.
import { createClient } from "npm:@supabase/supabase-js@2";
import type { LiveConnector } from "../../shared/contract.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const connectors: Record<string, (accountId: string) => LiveConnector> = {
  // tiktok_shop: tiktokConnector,   // POST /order/202309/orders/search, détail de commande, finance (provisoire puis écritures par commande)
  // whatnot: whatnotConnector,      // GET /orders, /orders/{id}/items, rapports asynchrones (POST /reports puis GET /reports/{id})
};

Deno.serve(async () => {
  const { data: jobs } = await db.from("sync_jobs").select("id,account_id,kind,attempts").eq("state", "queued").lte("run_after", new Date().toISOString()).limit(10);
  for (const job of jobs ?? []) {
    const { data: acc } = await db.from("provider_accounts").select("id,provider,status").eq("id", job.account_id).single();
    if (!acc || acc.status !== "connected" || !connectors[acc.provider]) { await db.from("sync_jobs").update({ state: "failed", last_error: "connector missing or account not connected" }).eq("id", job.id); continue; }
    try {
      // const c = connectors[acc.provider](acc.id);
      // pages = c.listOrderChanges(fenêtre avec chevauchement, curseur) ; pour chaque OrderRef : c.readOrder → normaliser → upsert idempotent → effets de stock.
      await db.from("sync_jobs").update({ state: "done" }).eq("id", job.id);
    } catch (e) {
      const wait = Math.min(3600, 2 ** (job.attempts + 1) * 30) + Math.floor(Math.random() * 15);   // temporisation + aléa
      await db.from("sync_jobs").update({ state: "queued", attempts: job.attempts + 1, last_error: String(e).slice(0, 200), run_after: new Date(Date.now() + wait * 1000).toISOString() }).eq("id", job.id);
    }
  }
  return new Response("ok");
});
