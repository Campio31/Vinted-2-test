// POST /webhooks/:provider — récepteur de notifications (SQUELETTE, non déployé, non testé contre une vraie plateforme).
// Rôle : vérifier la signature et le compte, enregistrer l'événement et un job de façon durable, répondre vite. Le travail se fait dans live-sync-worker.
//
// À COMPLÉTER avec la documentation officielle de chaque plateforme (spécification, sections 3 et 4) :
//   - TikTok Shop : procédure de vérification du webhook entrant (distincte de la signature des appels sortants) [T11].
//   - Whatnot : format Standard Webhooks documenté [W3].
// Les deux adaptateurs ne partagent NI le code de vérification NI le mapping des statuts bruts.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Verifier = (req: Request, body: string) => Promise<{ ok: boolean; deliveryId?: string; externalShopId?: string }>;
const verifiers: Record<string, Verifier> = {
  // tiktok_shop: verifierTikTok,   // à écrire d'après la doc officielle
  // whatnot: verifierWhatnot,      // à écrire d'après la doc officielle
};

Deno.serve(async (req) => {
  const provider = new URL(req.url).pathname.split("/").pop() ?? "";
  const verify = verifiers[provider];
  if (!verify) return new Response("not implemented", { status: 501 });   // jamais de « succès » tant que la vérification n'existe pas

  const body = await req.text();
  const v = await verify(req, body);
  if (!v.ok || !v.externalShopId) return new Response("invalid signature", { status: 401 });

  const { data: account } = await db.from("provider_accounts").select("id,status").eq("provider", provider).eq("external_shop_id", v.externalShopId).maybeSingle();
  if (!account || account.status === "revoked") return new Response("unknown account", { status: 404 });

  // Idempotence : identifiant de livraison quand il est fourni, empreinte de repli sinon. On ne garde pas les données acheteurs dans les journaux.
  const fingerprint = v.deliveryId ? null : await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)).then((b) => btoa(String.fromCharCode(...new Uint8Array(b))));
  const { error } = await db.from("provider_events").insert({ account_id: account.id, delivery_id: v.deliveryId ?? null, fingerprint, payload: JSON.parse(body) });
  if (error && error.code !== "23505") return new Response("retry", { status: 500 });   // 23505 : doublon, déjà reçu → on répond OK
  await db.from("sync_jobs").insert({ account_id: account.id, kind: "orders" });
  return new Response("ok", { status: 200 });
});
