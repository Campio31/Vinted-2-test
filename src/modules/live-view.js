import { app } from '../state.js';
import { $, esc, eur, fd } from './core.js';
import { TI, TOOLS, sheetHead, showSheet } from './tools-index.js';
import { DEMO_ACCOUNT, loadDemo, replayDemo } from './live-demo.js';
import * as C from './live-core.js';

/* ---------- Live connecté : écrans ---------- */
/* Connexions, Lives, Ballots, À rapprocher. Les données vivent dans les réglages synchronisés (cfg.liveco). Tant que le serveur Live n'est pas en place (dossier server/),
   seul le connecteur de test alimente l'état : il ne touche jamais aux fiches réelles de Syno. */
TOOLS.splice(Math.max(0, TOOLS.findIndex(x => x.k === 'rappels')), 0,
  { k: 'liveco', t: 'Live connecté', d: 'Tes ventes de live, ton stock et le résultat de tes ballots, sans saisie', i: TI('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3M7 10h5M7 14h3"/>') });
const openTool0 = app.openTool; app.openTool = k => (k === 'liveco' ? openLiveco() : openTool0(k));

const get = () => app.cfg.liveco && app.cfg.liveco.v ? app.cfg.liveco : C.emptyState();
const put = s => { app.setCfg({ liveco: s }); };
const money = c => (c == null ? '—' : eur(c / 100));
const STAGE = { settled: 'comptabilisé', provisional: 'provisoire', mixed: 'en partie provisoire' };
const PROV = { tiktok_shop: 'TikTok Shop', whatnot: 'Whatnot', test: 'Connecteur de test' };
const LV = { orders: 'Commandes', lives: 'Lives', finance: 'Finance', inventory_write: 'Écriture du stock' }, LEVEL = { documented: 'documenté', authorized: 'autorisé', verified: 'vérifié' };
let view = { tab: 'lives', id: '' };

const stageTag = st => (st ? `<small class="tag x" style="margin-left:6px">${t(STAGE[st])}</small>` : '');
const sessionName = (s, x) => x.title || t('Live {n}', { n: x.extLiveId });
const lineLabel = (s, l) => { const k = l.att && l.att.target && s.variants[l.att.target.id]; return k ? k.label : (l.merchantSku || l.listingId || l.variantId || l.orderId); };
const pill = (txt, c) => `<span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:${c};border-radius:999px;padding:2px 8px;margin-left:6px">${esc(txt)}</span>`;
const STC = { pending: '#9AA0A6', confirmed: '#1D9E75', cancelled: '#E24B4A', unknown: '#9AA0A6' }, STL = { pending: 'en attente', confirmed: 'confirmée', cancelled: 'annulée', unknown: 'statut inconnu' };

/* ---- onglets ---- */
function tabsHTML(s) {
  const n = C.toMatch(s).length, T = [['conn', 'Connexions'], ['lives', 'Lives'], ['ballots', 'Ballots'], ['match', 'À rapprocher']];
  return `<div class="chips" style="margin-bottom:12px">${T.map(([k, l]) => `<button type="button" class="chip${view.tab === k ? ' on' : ''}" data-lv="tab" data-v="${k}">${t(l)}${k === 'match' && n ? ' · ' + n : ''}</button>`).join('')}</div>`;
}
function connHTML(s) {
  const demo = s.accounts.some(a => a.id === DEMO_ACCOUNT);
  const acc = s.accounts.map(a => `<div class="card"><h3>${esc(a.shop || t(PROV[a.provider]))}${pill(a.status === 'reconnect' ? t('À reconnecter') : a.provider === 'test' ? t('Test') : t('Connecté'), a.status === 'reconnect' ? '#E24B4A' : a.provider === 'test' ? '#9AA0A6' : '#1D9E75')}</h3>
    <p class="sub">${esc(t(PROV[a.provider]))} · ${esc(a.market || '')}${a.lastSync ? ' · ' + t('dernière synchro le {d}', { d: fd(String(a.lastSync).slice(0, 10)) }) : ''}</p>
    ${C.CAPS.map(c => `<div style="display:flex;justify-content:space-between;font-size:14px;margin:3px 0"><span>${t(LV[c])}</span><b>${t(LEVEL[C.capLevel(a, c)])}</b></div>`).join('')}
    <div class="hint" style="margin-top:6px">${C.stockSyncActive(a) ? t('Synchro du stock active') : t('Lecture seule : le stock se met à jour dans Syno, pas sur la plateforme.')}</div></div>`).join('');
  const stock = Object.entries(s.variants).map(([id, v]) => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;margin:4px 0"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.label)}</span><b style="font-variant-numeric:tabular-nums;color:${v.onHand < 0 ? 'var(--red)' : 'inherit'}">${v.onHand}${v.reserved ? ' · ' + t('{n} réservée(s)', { n: v.reserved }) : ''}</b></div>`).join('');
  return `<p class="sub">${t('Syno lit tes ventes en lecture seule. La diffusion, les expéditions et les annulations restent sur la plateforme.')}</p>${acc}
  <div class="card"><h3>${t('Ajouter une boutique')}</h3><button type="button" class="btn sec" data-lv="tiktok" style="width:100%">${t('Connecter TikTok Shop')}</button><div class="hint" id="lv_tt" style="margin-top:8px" hidden>${t('La connexion de ta boutique demande un serveur Live (dossier server/), un compte développeur TikTok Shop validé et l\'autorisation vendeur pour la seconde main. Elle n\'est pas encore ouverte : tes données ne quittent pas cet appareil.')}</div>
  <div class="hint" style="margin-top:8px">${t('Whatnot n\'apparaît pas tant que son accès pour les applications tierces n\'est pas confirmé.')}</div></div>
  <div class="card"><h3>${t('Démonstration')}</h3><p class="sub">${t('Des commandes simulées pour essayer les écrans. Elles ne touchent jamais à tes fiches.')}</p><div class="acts" style="margin:0">${demo ? `<button type="button" class="btn sec" data-lv="replay">${t('Rejouer les notifications')}</button><button type="button" class="btn sec" data-lv="undemo">${t('Supprimer la démonstration')}</button>` : `<button type="button" class="btn mint" data-lv="demo">${t('Charger la démonstration')}</button>`}</div></div>
  ${stock ? `<div class="card"><h3>${t('Stock suivi')}</h3>${stock}</div>` : ''}`;
}
function livesHTML(s) {
  if (!s.sessions.length) return `<div class="empty">${t('Aucun live pour l\'instant. Charge la démonstration ou connecte une boutique.')}</div>`;
  return s.sessions.slice().sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt))).map(x => {
    const m = C.sessionSummary(s, x.id), a = s.accounts.find(q => q.id === x.accountId);
    return `<button type="button" class="li" data-lv="session" data-id="${esc(x.id)}" style="margin-bottom:8px"><div class="m"><b>${esc(sessionName(s, x))}</b><small>${esc(t(PROV[a ? a.provider : 'test']))}${x.startsAt ? ' · ' + fd(String(x.startsAt).slice(0, 10)) : ''} · ${tn(m.orders, 'commande', 'commandes')} · ${tn(m.items, 'pièce', 'pièces')}${m.toMatch ? ' · ' + t('{n} à rapprocher', { n: m.toMatch }) : ''}</small></div><div class="p">${money(m.net == null ? m.gross : m.net)}<small>${m.net == null ? t('brut') : t(STAGE[m.stage])}</small></div></button>`;
  }).join('');
}
function sessionHTML(s) {
  const x = s.sessions.find(q => q.id === view.id); if (!x) return livesHTML(s);
  const m = C.sessionSummary(s, x.id), exclusive = x.mode === 'exclusive_ballot', def = s.rules.find(r => r.sessionId === x.id && r.isDefault);
  const lines = Object.entries(s.lines).filter(([, l]) => l.att && l.att.sessionId === x.id).map(([k, l]) => {
    const b = l.att.ballotId && s.ballots.find(q => q.id === l.att.ballotId);
    return `<div style="padding:8px 0;border-top:1px solid var(--soft)"><div style="display:flex;justify-content:space-between;gap:8px"><b style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(lineLabel(s, l))}</b><span style="font-variant-numeric:tabular-nums">${money(l.gross)}</span></div><div class="hint" style="margin:2px 0 0">${esc(l.orderId)} · ×${l.quantity}${pill(t(STL[l.status]), STC[l.status])}${b ? pill(b.label, '#2F6FDE') : ''}${l.att.status !== 'ok' ? pill(t('À rapprocher'), '#E07B12') : ''}</div></div>`;
  }).join('');
  const bopt = s.ballots.map(b => `<option value="${esc(b.id)}"${def && def.ballotId === b.id ? ' selected' : ''}>${esc(b.label)}</option>`).join('');
  return `<button type="button" class="chip sm" data-lv="tab" data-v="lives" style="margin-bottom:10px">‹ ${t('Lives')}</button>
  <div class="card"><h3>${esc(sessionName(s, x))}</h3><div class="kpis"><div class="kpi"><b>${money(m.gross)}</b><span>${t('brut')}</span></div><div class="kpi"><b>${m.net == null ? t('Net indisponible') : money(m.net)}</b><span>${m.net == null ? t('frais inconnus') : t(STAGE[m.stage])}</span></div><div class="kpi"><b>${m.cancelled}</b><span>${t('annulées')}</span></div></div>
  <div class="hint">${t('Une fin de live ne veut pas dire que les règlements sont finalisés : le net passe de provisoire à comptabilisé plus tard.')}</div></div>
  <div class="card"><h3>${t('Associer un ballot')}</h3>${s.ballots.length ? `<div class="fld"><select id="lv_b">${bopt}</select></div><label class="chk cfr" style="margin:8px 0"><input type="checkbox" id="lv_ex"${exclusive ? ' checked' : ''}><span><b>${t('Toutes les ventes non classées de ce live')}</b><small>${t('À cocher seulement si ce direct est consacré à ce ballot. Une pièce déjà identifiée n\'est pas déplacée.')}</small></span></label><button type="button" class="btn sm mint" data-lv="assoc" data-id="${esc(x.id)}">${t('Enregistrer')}</button>` : `<div class="hint">${t('Crée d\'abord un ballot dans l\'onglet Ballots.')}</div>`}</div>
  <div class="card"><h3>${t('Ventes du live')} · ${m.lines}</h3>${lines || `<div class="hint">${t('Aucune vente attribuée à ce live.')}</div>`}</div>`;
}
function ballotsHTML(s) {
  const form = `<div class="card"><h3>${t('Nouveau ballot')}</h3><div class="row2"><input type="text" id="nb_l" placeholder="${t('Nom du ballot')}" autocomplete="off"><div class="price"><input type="text" inputmode="decimal" id="nb_c" placeholder="0"><span>€</span></div></div><div class="hint" style="margin:6px 0">${t('Coût livré, frais de port compris.')}</div><button type="button" class="btn sm mint" data-lv="newb">${t('Créer le ballot')}</button></div>`;
  if (!s.ballots.length) return `<div class="empty">${t('Aucun ballot. Crée-en un pour suivre ce qu\'il rapporte, live après live.')}</div>${form}`;
  return s.ballots.map(b => {
    const r = C.ballotResult(s, b.id), off = C.offLiveForBallot(s, b.id), pc = r.net == null ? 0 : Math.max(0, Math.min(100, r.net / (b.landedCost || 1) * 100));
    return `<div class="card"><h3>${esc(b.label)}${r.provisional ? stageTag('provisional') : r.stage ? stageTag('settled') : ''}</h3><p class="sub">${esc(b.supplier || '')}${b.supplier ? ' · ' : ''}${t('coût livré {c}', { c: money(b.landedCost) })} · ${tn(r.sessions.length, 'live', 'lives')}</p>
    <div style="height:10px;background:var(--soft);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${pc}%;background:${r.ecart != null && r.ecart >= 0 ? '#1D9E75' : '#2F6FDE'}"></i></div>
    <div class="kpis" style="margin-top:8px"><div class="kpi"><b>${r.net == null ? t('Net indisponible') : money(r.net)}</b><span>${r.net == null ? t('brut {b}', { b: money(r.gross) }) : t('net attribué')}</span></div><div class="kpi"><b>${r.net == null ? '—' : r.ecart >= 0 ? '+' + money(r.ecart) : money(r.reste)}</b><span>${r.net == null ? '' : r.ecart >= 0 ? t('au-dessus du coût') : t('reste à récupérer')}</span></div></div>
    ${r.ambiguous ? `<div class="hint">${t('{n} ligne(s) ambiguë(s) ne comptent pas dans ce résultat.', { n: r.ambiguous })}</div>` : ''}${r.notSpread ? `<div class="hint">${t('Frais non ventilés : {n} commande(s).', { n: r.notSpread })}</div>` : ''}${off.gross != null ? `<div class="hint">${t('Hors live : {c} de ventes liées à ce ballot.', { c: money(off.gross) })}</div>` : ''}
    <div class="hint">${t('Ce montant compare les ventes au coût d\'achat : ce n\'est pas ton bénéfice comptable.')}</div></div>`;
  }).join('') + form;
}
function matchHTML(s) {
  const L = C.toMatch(s); if (!L.length) return `<div class="empty">${t('Tout est rapproché.')}</div>`;
  const vopt = Object.entries(s.variants).map(([id, v]) => `<option value="${esc(id)}">${esc(v.label)}</option>`).join(''), bopt = s.ballots.map(b => `<option value="${esc(b.id)}">${esc(b.label)}</option>`).join('');
  const TX = { sku_inconnu: 'Référence inconnue', cible_inconnue: 'Vente sans pièce ni ballot', hors_live: 'Vente hors live sans pièce', ambigu: 'Ligne ambiguë', sans_ballot: 'Pas de ballot rattaché', frais_non_ventiles: 'Frais non ventilés', stock_gap: 'Écart de stock', acces_perdu: 'Accès perdu' };
  return L.map((x, i) => {
    const head = `<b>${t(TX[x.type] || x.type)}</b>`;
    if (x.type === 'acces_perdu') return `<div class="card">${head}<div class="hint">${t('Reconnecte ce compte pour reprendre la synchronisation.')}</div></div>`;
    if (x.type === 'stock_gap') { const v = s.variants[x.variantId]; return `<div class="card">${head}<div class="hint">${t('Il manque {n} pièce(s) pour « {v} » : la vente est gardée, le stock théorique est négatif.', { n: x.missing, v: v ? v.label : x.variantId })}</div><button type="button" class="btn sm sec" data-lv="gap" data-id="${esc(x.variantId)}" data-n="${x.missing}">${t('Corriger le stock')}</button></div>`; }
    const l = x.line; if (!l) return '';
    const sub = `<div class="hint" style="margin:2px 0 6px">${esc(l.orderId)} · ${esc(l.merchantSku || l.listingId || l.variantId || '')} · ${money(l.gross)}</div>`;
    if (x.type === 'frais_non_ventiles') return `<div class="card">${head}${sub}<div class="hint">${t('Les frais sont donnés pour toute la commande alors que ses lignes vont vers des cibles différentes.')}</div></div>`;
    if (x.type === 'sku_inconnu') return `<div class="card">${head}${sub}<div class="fld"><select data-pick="${i}">${vopt}</select></div><button type="button" class="btn sm mint" data-lv="link" data-i="${i}" data-k="${esc(x.lineKey)}" style="margin-top:6px">${t('Lier à cette référence')}</button></div>`;
    return `<div class="card">${head}${sub}${bopt ? `<div class="fld"><select data-pick="${i}">${bopt}</select></div><button type="button" class="btn sm mint" data-lv="ovr" data-i="${i}" data-k="${esc(x.lineKey)}" style="margin-top:6px">${t('Attribuer à ce ballot')}</button>` : `<div class="hint">${t('Crée d\'abord un ballot dans l\'onglet Ballots.')}</div>`}</div>`;
  }).join('');
}

/* ---- ouverture et actions ---- */
export function openLiveco(tab) {
  if (tab) view = { tab, id: '' };
  const s = get(), body = view.tab === 'conn' ? connHTML(s) : view.tab === 'ballots' ? ballotsHTML(s) : view.tab === 'match' ? matchHTML(s) : (view.id ? sessionHTML(s) : livesHTML(s));
  showSheet(sheetHead(t('Live connecté')) + tabsHTML(s) + body);
  $('shc').onclick = onClick;
}
function onClick(e) {
  const b = e.target.closest('[data-lv]'); if (!b) return; const a = b.dataset.lv; let s = get();
  if (a === 'tab') { view = { tab: b.dataset.v, id: '' }; return openLiveco(); }
  if (a === 'session') { view = { tab: 'lives', id: b.dataset.id }; return openLiveco(); }
  if (a === 'tiktok') { $('lv_tt').hidden = false; return; }
  if (a === 'demo') { put(loadDemo(s)); view = { tab: 'lives', id: '' }; return openLiveco(); }
  if (a === 'replay') { put(replayDemo(s)); return openLiveco(); }
  if (a === 'undemo') { const n = C.emptyState(); put(n); return openLiveco(); }
  if (a === 'assoc') { const id = $('lv_b') && $('lv_b').value; if (!id) return; s = C.setSessionMode(s, b.dataset.id, $('lv_ex').checked ? 'exclusive_ballot' : 'normal'); s.rules = s.rules.filter(r => !(r.sessionId === b.dataset.id && r.isDefault)); if ($('lv_ex').checked) s = C.addRule(s, { sessionId: b.dataset.id, ballotId: id, isDefault: true }).state; put(s); return openLiveco(); }
  if (a === 'newb') { const l = $('nb_l').value.trim(); if (!l) return; put(C.addBallot(s, { label: l, landedCost: $('nb_c').value || '0' }).state); return openLiveco(); }
  if (a === 'gap') { put(C.adjustStock(s, b.dataset.id, +b.dataset.n, 'correction')); return openLiveco(); }
  if (a === 'link' || a === 'ovr') {
    const sel = document.querySelector(`#shc [data-pick="${b.dataset.i}"]`), l = s.lines[b.dataset.k]; if (!sel || !l) return;
    if (a === 'link') s = C.addLink(s, { accountId: l.accountId, extVariantId: l.variantId || l.merchantSku, merchantSku: l.merchantSku, kind: s.variants[sel.value] && s.variants[sel.value].unique ? 'piece' : 'variant', targetId: sel.value, source: 'manual' });
    else s = C.overrideLine(s, b.dataset.k, { ballotId: sel.value }, 'moi', 'rapprochement manuel', new Date().toISOString().slice(0, 10));
    put(s); return openLiveco();
  }
}
app.openLiveco = openLiveco;

/* ---------- traductions (K : français, English, Italiano, Español, Deutsch) ---------- */
if (typeof window !== 'undefined' && window.K) {
  const K = window.K;
  K("Live connecté", "Connected live", "Live collegato", "Live conectado", "Verbundenes Live");
  K("Tes ventes de live, ton stock et le résultat de tes ballots, sans saisie", "Your live sales, your stock and the result of your bales, without typing", "Le vendite dei live, lo stock e il risultato delle balle, senza digitare", "Tus ventas de live, tu stock y el resultado de tus fardos, sin teclear", "Deine Live-Verkäufe, dein Bestand und das Ergebnis deiner Ballen, ohne Eingabe");
  K("Connexions", "Connections", "Collegamenti", "Conexiones", "Verbindungen");
  K("Lives", "Lives", "Live", "Lives", "Lives");
  K("Ballots", "Bales", "Balle", "Fardos", "Ballen");
  K("À rapprocher", "To match", "Da abbinare", "Por emparejar", "Zuzuordnen");
  K("Live {n}", "Live {n}", "Live {n}", "Live {n}", "Live {n}");
  K("commandes", "orders", "ordini", "pedidos", "Bestellungen");
  K("commande", "order", "ordine", "pedido", "Bestellung");
  K("live", "live", "live", "live", "Live");
  K("lives", "lives", "live", "lives", "Lives");
  K("à rapprocher", "to match", "da abbinare", "por emparejar", "zuzuordnen");
  K("{n} à rapprocher", "{n} to match", "{n} da abbinare", "{n} por emparejar", "{n} zuzuordnen");
  K("TikTok Shop", "TikTok Shop", "TikTok Shop", "TikTok Shop", "TikTok Shop");
  K("Whatnot", "Whatnot", "Whatnot", "Whatnot", "Whatnot");
  K("Connecteur de test", "Test connector", "Connettore di prova", "Conector de prueba", "Testverbindung");
  K("Commandes", "Orders", "Ordini", "Pedidos", "Bestellungen");
  K("Finance", "Finance", "Finanza", "Finanzas", "Finanzen");
  K("Écriture du stock", "Stock writing", "Scrittura dello stock", "Escritura del stock", "Bestandsschreibung");
  K("documenté", "documented", "documentato", "documentado", "dokumentiert");
  K("autorisé", "authorized", "autorizzato", "autorizado", "autorisiert");
  K("vérifié", "verified", "verificato", "verificado", "geprüft");
  K("comptabilisé", "booked", "contabilizzato", "contabilizado", "verbucht");
  K("provisoire", "provisional", "provvisorio", "provisional", "vorläufig");
  K("en partie provisoire", "partly provisional", "in parte provvisorio", "en parte provisional", "teilweise vorläufig");
  K("À reconnecter", "To reconnect", "Da ricollegare", "Por reconectar", "Neu verbinden");
  K("Test", "Test", "Prova", "Prueba", "Test");
  K("Connecté", "Connected", "Collegato", "Conectado", "Verbunden");
  K("dernière synchro le {d}", "last sync on {d}", "ultima sincronizzazione il {d}", "última sincronización el {d}", "letzte Synchronisierung am {d}");
  K("Synchro du stock active", "Stock sync active", "Sincronizzazione dello stock attiva", "Sincronización del stock activa", "Bestandssynchronisierung aktiv");
  K("Lecture seule : le stock se met à jour dans Syno, pas sur la plateforme.", "Read-only: stock is updated in Syno, not on the platform.", "Sola lettura: lo stock si aggiorna in Syno, non sulla piattaforma.", "Solo lectura: el stock se actualiza en Syno, no en la plataforma.", "Nur Lesen: Der Bestand wird in Syno aktualisiert, nicht auf der Plattform.");
  K("{n} réservée(s)", "{n} reserved", "{n} riservato/i", "{n} reservada(s)", "{n} reserviert");
  K("Syno lit tes ventes en lecture seule. La diffusion, les expéditions et les annulations restent sur la plateforme.", "Syno reads your sales read-only. Streaming, shipping and cancellations stay on the platform.", "Syno legge le vendite in sola lettura. Diretta, spedizioni e annullamenti restano sulla piattaforma.", "Syno lee tus ventas en solo lectura. La emisión, los envíos y las cancelaciones se quedan en la plataforma.", "Syno liest deine Verkäufe nur lesend. Übertragung, Versand und Stornierungen bleiben auf der Plattform.");
  K("Ajouter une boutique", "Add a shop", "Aggiungi un negozio", "Añadir una tienda", "Shop hinzufügen");
  K("Connecter TikTok Shop", "Connect TikTok Shop", "Collega TikTok Shop", "Conectar TikTok Shop", "TikTok Shop verbinden");
  K("La connexion de ta boutique demande un serveur Live (dossier server/), un compte développeur TikTok Shop validé et l'autorisation vendeur pour la seconde main. Elle n'est pas encore ouverte : tes données ne quittent pas cet appareil.", "Connecting your shop needs a Live server (server/ folder), a validated TikTok Shop developer account and seller authorization for second-hand. It is not open yet: your data does not leave this device.", "Collegare il tuo negozio richiede un server Live (cartella server/), un account sviluppatore TikTok Shop convalidato e l'autorizzazione venditore per l'usato. Non è ancora aperto: i tuoi dati non lasciano questo dispositivo.", "Conectar tu tienda requiere un servidor Live (carpeta server/), una cuenta de desarrollador de TikTok Shop validada y la autorización de vendedor para segunda mano. Aún no está abierta: tus datos no salen de este dispositivo.", "Die Verbindung deines Shops erfordert einen Live-Server (Ordner server/), ein bestätigtes TikTok-Shop-Entwicklerkonto und die Verkäufer-Freigabe für Secondhand. Sie ist noch nicht geöffnet: Deine Daten verlassen dieses Gerät nicht.");
  K("Whatnot n'apparaît pas tant que son accès pour les applications tierces n'est pas confirmé.", "Whatnot does not appear until its access for third-party apps is confirmed.", "Whatnot non compare finché il suo accesso per le app di terzi non è confermato.", "Whatnot no aparece hasta que se confirme su acceso para aplicaciones de terceros.", "Whatnot erscheint nicht, solange der Zugang für Drittanbieter-Apps nicht bestätigt ist.");
  K("Démonstration", "Demo", "Dimostrazione", "Demostración", "Demo");
  K("Des commandes simulées pour essayer les écrans. Elles ne touchent jamais à tes fiches.", "Simulated orders to try the screens. They never touch your listings.", "Ordini simulati per provare le schermate. Non toccano mai le tue schede.", "Pedidos simulados para probar las pantallas. Nunca tocan tus fichas.", "Simulierte Bestellungen zum Ausprobieren der Bildschirme. Sie berühren nie deine Einträge.");
  K("Rejouer les notifications", "Replay the notifications", "Riproduci le notifiche", "Repetir las notificaciones", "Benachrichtigungen erneut abspielen");
  K("Supprimer la démonstration", "Delete the demo", "Elimina la dimostrazione", "Eliminar la demostración", "Demo löschen");
  K("Charger la démonstration", "Load the demo", "Carica la dimostrazione", "Cargar la demostración", "Demo laden");
  K("Stock suivi", "Tracked stock", "Stock seguito", "Stock seguido", "Verfolgter Bestand");
  K("Aucun live pour l'instant. Charge la démonstration ou connecte une boutique.", "No live yet. Load the demo or connect a shop.", "Nessun live per ora. Carica la dimostrazione o collega un negozio.", "Aún no hay ningún live. Carga la demostración o conecta una tienda.", "Noch kein Live. Lade die Demo oder verbinde einen Shop.");
  K("pièce", "item", "capo", "prenda", "Teil");
  K("pièces", "items", "capi", "prendas", "Teile");
  K("brut", "gross", "lordo", "bruto", "brutto");
  K("Net indisponible", "Net unavailable", "Netto non disponibile", "Neto no disponible", "Netto nicht verfügbar");
  K("frais inconnus", "fees unknown", "commissioni sconosciute", "gastos desconocidos", "Gebühren unbekannt");
  K("annulées", "cancelled", "annullate", "canceladas", "storniert");
  K("Une fin de live ne veut pas dire que les règlements sont finalisés : le net passe de provisoire à comptabilisé plus tard.", "The end of a live does not mean payouts are final: the net goes from provisional to booked later.", "La fine di un live non significa che i pagamenti siano definitivi: il netto passa da provvisorio a contabilizzato più tardi.", "El final de un live no significa que los pagos sean definitivos: el neto pasa de provisional a contabilizado más tarde.", "Das Ende eines Lives heißt nicht, dass die Auszahlungen endgültig sind: Das Netto wechselt später von vorläufig zu verbucht.");
  K("Associer un ballot", "Link a bale", "Associa una balla", "Asociar un fardo", "Ballen zuordnen");
  K("Toutes les ventes non classées de ce live", "All unclassified sales of this live", "Tutte le vendite non classificate di questo live", "Todas las ventas sin clasificar de este live", "Alle nicht zugeordneten Verkäufe dieses Lives");
  K("À cocher seulement si ce direct est consacré à ce ballot. Une pièce déjà identifiée n'est pas déplacée.", "Tick only if this stream is dedicated to this bale. An item already identified is not moved.", "Da spuntare solo se questa diretta è dedicata a questa balla. Un capo già identificato non viene spostato.", "Marcar solo si esta emisión está dedicada a este fardo. Una prenda ya identificada no se mueve.", "Nur ankreuzen, wenn diese Übertragung diesem Ballen gewidmet ist. Ein bereits erkanntes Teil wird nicht verschoben.");
  K("Enregistrer", "Save", "Salva", "Guardar", "Speichern");
  K("Crée d'abord un ballot dans l'onglet Ballots.", "First create a bale in the Bales tab.", "Crea prima una balla nella scheda Balle.", "Crea primero un fardo en la pestaña Fardos.", "Lege zuerst im Reiter Ballen einen Ballen an.");
  K("Ventes du live", "Sales of the live", "Vendite del live", "Ventas del live", "Verkäufe des Lives");
  K("Aucune vente attribuée à ce live.", "No sale assigned to this live.", "Nessuna vendita assegnata a questo live.", "Ninguna venta asignada a este live.", "Kein Verkauf diesem Live zugeordnet.");
  K("en attente", "pending", "in attesa", "pendiente", "ausstehend");
  K("confirmée", "confirmed", "confermata", "confirmada", "bestätigt");
  K("annulée", "cancelled", "annullata", "cancelada", "storniert");
  K("statut inconnu", "unknown status", "stato sconosciuto", "estado desconocido", "unbekannter Status");
  K("Nouveau ballot", "New bale", "Nuova balla", "Nuevo fardo", "Neuer Ballen");
  K("Nom du ballot", "Bale name", "Nome della balla", "Nombre del fardo", "Ballenname");
  K("Coût livré, frais de port compris.", "Delivered cost, shipping included.", "Costo consegnato, spedizione inclusa.", "Coste entregado, envío incluido.", "Gelieferte Kosten, Versand inklusive.");
  K("Créer le ballot", "Create the bale", "Crea la balla", "Crear el fardo", "Ballen anlegen");
  K("Aucun ballot. Crée-en un pour suivre ce qu'il rapporte, live après live.", "No bale. Create one to follow what it earns, live after live.", "Nessuna balla. Creane una per seguire quanto rende, live dopo live.", "Ningún fardo. Crea uno para seguir lo que rinde, live tras live.", "Kein Ballen. Lege einen an, um zu sehen, was er einbringt, Live für Live.");
  K("coût livré {c}", "delivered cost {c}", "costo consegnato {c}", "coste entregado {c}", "gelieferte Kosten {c}");
  K("brut {b}", "gross {b}", "lordo {b}", "bruto {b}", "brutto {b}");
  K("net attribué", "net assigned", "netto attribuito", "neto atribuido", "zugeordnetes Netto");
  K("au-dessus du coût", "above the cost", "sopra il costo", "por encima del coste", "über den Kosten");
  K("reste à récupérer", "left to recover", "resta da recuperare", "queda por recuperar", "noch zurückzuholen");
  K("{n} ligne(s) ambiguë(s) ne comptent pas dans ce résultat.", "{n} ambiguous line(s) are not counted in this result.", "{n} riga/righe ambigua/e non contano in questo risultato.", "{n} línea(s) ambigua(s) no cuentan en este resultado.", "{n} mehrdeutige Zeile(n) zählen nicht in dieses Ergebnis.");
  K("Frais non ventilés : {n} commande(s).", "Unallocated fees: {n} order(s).", "Commissioni non ripartite: {n} ordine/i.", "Gastos sin repartir: {n} pedido(s).", "Nicht aufgeteilte Gebühren: {n} Bestellung(en).");
  K("Hors live : {c} de ventes liées à ce ballot.", "Outside lives: {c} of sales linked to this bale.", "Fuori dai live: {c} di vendite legate a questa balla.", "Fuera de los lives: {c} de ventas ligadas a este fardo.", "Außerhalb von Lives: {c} Verkäufe, die diesem Ballen zugeordnet sind.");
  K("Ce montant compare les ventes au coût d'achat : ce n'est pas ton bénéfice comptable.", "This amount compares sales with the purchase cost: it is not your accounting profit.", "Questo importo confronta le vendite con il costo d'acquisto: non è il tuo utile contabile.", "Este importe compara las ventas con el coste de compra: no es tu beneficio contable.", "Dieser Betrag vergleicht Verkäufe mit den Einkaufskosten: Er ist nicht dein buchhalterischer Gewinn.");
  K("Tout est rapproché.", "Everything is matched.", "Tutto è abbinato.", "Todo está emparejado.", "Alles ist zugeordnet.");
  K("Référence inconnue", "Unknown reference", "Riferimento sconosciuto", "Referencia desconocida", "Unbekannte Referenz");
  K("Vente sans pièce ni ballot", "Sale with no item or bale", "Vendita senza capo né balla", "Venta sin prenda ni fardo", "Verkauf ohne Teil oder Ballen");
  K("Vente hors live sans pièce", "Off-live sale with no item", "Vendita fuori live senza capo", "Venta fuera de live sin prenda", "Verkauf außerhalb des Lives ohne Teil");
  K("Ligne ambiguë", "Ambiguous line", "Riga ambigua", "Línea ambigua", "Mehrdeutige Zeile");
  K("Pas de ballot rattaché", "No bale linked", "Nessuna balla collegata", "Ningún fardo asociado", "Kein Ballen zugeordnet");
  K("Frais non ventilés", "Unallocated fees", "Commissioni non ripartite", "Gastos sin repartir", "Nicht aufgeteilte Gebühren");
  K("Écart de stock", "Stock gap", "Scarto di stock", "Diferencia de stock", "Bestandsabweichung");
  K("Accès perdu", "Access lost", "Accesso perso", "Acceso perdido", "Zugang verloren");
  K("Reconnecte ce compte pour reprendre la synchronisation.", "Reconnect this account to resume synchronization.", "Ricollega questo account per riprendere la sincronizzazione.", "Reconecta esta cuenta para reanudar la sincronización.", "Verbinde dieses Konto neu, um die Synchronisierung fortzusetzen.");
  K("Il manque {n} pièce(s) pour « {v} » : la vente est gardée, le stock théorique est négatif.", "{n} item(s) missing for « {v} »: the sale is kept, the theoretical stock is negative.", "Mancano {n} capo/i per « {v} »: la vendita è mantenuta, lo stock teorico è negativo.", "Faltan {n} prenda(s) para « {v} »: la venta se mantiene, el stock teórico es negativo.", "Es fehlen {n} Teil(e) für « {v} »: Der Verkauf bleibt erhalten, der theoretische Bestand ist negativ.");
  K("Corriger le stock", "Fix the stock", "Correggi lo stock", "Corregir el stock", "Bestand korrigieren");
  K("Les frais sont donnés pour toute la commande alors que ses lignes vont vers des cibles différentes.", "Fees are given for the whole order while its lines go to different targets.", "Le commissioni sono indicate per tutto l'ordine mentre le sue righe vanno verso destinazioni diverse.", "Los gastos se dan para todo el pedido mientras sus líneas van a destinos distintos.", "Die Gebühren gelten für die ganze Bestellung, obwohl ihre Zeilen in verschiedene Ziele gehen.");
  K("Lier à cette référence", "Link to this reference", "Collega a questo riferimento", "Vincular a esta referencia", "Mit dieser Referenz verknüpfen");
  K("Attribuer à ce ballot", "Assign to this bale", "Assegna a questa balla", "Asignar a este fardo", "Diesem Ballen zuordnen");
}
