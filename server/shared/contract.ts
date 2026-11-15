// Contrat interne indicatif (spécification « Max Live », section 3).
// Ces méthodes sont celles de Syno, PAS des endpoints à copier chez les plateformes : chaque adaptateur vérifie la forme et la disponibilité des vrais champs avant de normaliser.
// Le moteur de référence (testé) est src/modules/live-core.js ; ce fichier fixe seulement la forme que les connecteurs serveur doivent lui fournir.

export type Provider = "tiktok_shop" | "whatnot";
export type Money = { minor: number; currency: string };           // centimes entiers
export type LineStatus = "pending" | "confirmed" | "cancelled" | "unknown";
export type LiveSource = "live" | "non_live" | "unknown";
export type TimeWindow = { from: string; to: string };
export type Page<T> = { items: T[]; next?: string };

export type CanonicalLine = {
  orderId: string;
  lineId: string;
  variantId: string | null;
  listingId: string | null;
  merchantSku: string | null;
  externalLiveId: string | null;     // TikTok : line_items[].room_id (UE) ; Whatnot : show_id de la commande. Jamais déduit de l'heure.
  source: LiveSource;
  quantity: number;
  status: LineStatus;
  rawStatus: string;
  gross: Money | null;
  providerUpdatedAt: string | null;
};
export type OrderRef = { orderId: string; updatedAt: string };
export type CanonicalOrder = { orderId: string; lines: CanonicalLine[]; providerUpdatedAt: string | null };
export type CanonicalLive = { externalLiveId: string; title?: string; startsAt?: string; endsAt?: string };
export type LedgerEntry = {
  key: string;                       // identifiant d'écriture stable ; sans clé stable, remplacer un instantané versionné par commande
  orderId: string; lineId?: string; liveId?: string;
  type: "sale" | "fee" | "refund" | "adjustment";
  amount: Money;                     // signé
  stage: "provisional" | "settled";
};

export interface LiveConnector {
  listOrderChanges(window: TimeWindow, cursor?: string): Promise<Page<OrderRef>>;
  readOrder(orderId: string): Promise<CanonicalOrder>;
  listLives?(window: TimeWindow, cursor?: string): Promise<Page<CanonicalLive>>;
  listFinanceChanges?(window: TimeWindow, cursor?: string): Promise<Page<LedgerEntry>>;
}
