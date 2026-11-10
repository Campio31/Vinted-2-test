// Edge Function « envoyer-rappels » : envoie les notifications push arrivées à échéance.
// Appelée chaque minute par la tâche planifiée (voir push-setup.sql). « Verify JWT » doit être désactivé :
// l'accès est protégé par le mot de passe interne x-cron-secret (table push_config).
// Secrets à créer dans Supabase (Edge Functions → Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const { data: cfg } = await db.from("push_config").select("secret").eq("id", 1).single();
  if (!cfg || req.headers.get("x-cron-secret") !== cfg.secret) return json({ error: "non autorisé" }, 401);

  // On « réserve » les rappels dus en les marquant envoyés (évite les doublons si deux appels se chevauchent).
  const { data: due, error } = await db.from("push_queue").update({ sent: true })
    .eq("sent", false).lte("send_at", new Date().toISOString()).select();
  if (error) return json({ error: error.message }, 500);

  const res = { dus: due?.length ?? 0, envoyes: 0, trop_vieux: 0, sans_appareil: 0, erreurs: [] as string[] };
  const maintenant = Date.now();

  for (const r of due ?? []) {
    if (maintenant - new Date(r.send_at).getTime() > 3 * 3600e3) { res.trop_vieux++; continue; }
    const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", r.user_id);
    if (!subs?.length) { res.sans_appareil++; continue; }
    const payload = JSON.stringify({ title: r.title, body: r.body, tag: r.tag });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
          { TTL: 3600, urgency: "high" });
        res.envoyes++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.from("push_subscriptions").delete().eq("user_id", s.user_id).eq("endpoint", s.endpoint);
        } else res.erreurs.push(`${code ?? ""} ${(e as Error).message}`.trim());
      }
    }
  }
  return json(res);
});
