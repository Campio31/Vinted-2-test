import './admin.css';

/* Page d'administration, réservée au compte listé dans la table app_admins (voir docs/admin-setup.sql).
   La protection est dans la base de données : la fonction admin_stats() refuse tout autre compte. */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = n => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));

const VUES = { list: 'Écran Stock', quick: 'Écran Vente rapide', add: 'Écran Ajouter', dash: 'Écran Tableau de bord', set: 'Écran Réglages' };
const OUTILS = {
  coach: 'Coach du lundi', ballot: 'Simulateur de ballot', nego: 'Négociation', qr: 'Étiquettes QR', trophees: 'Trophées', fisc: 'Ligne fiscale',
  complete: 'Compléter les fiches', merge: 'Doublons', photos: 'Photos et poids', depenses: 'Dépenses', treso: 'Trésorerie', rapport: 'Bilan mensuel PDF',
  trash: 'Corbeille', visuels: 'Visuels réseaux', wrapped: 'Wrapped', calcom: 'Calendrier commercial', rappels: 'Rappels', defis: 'Défis du mois',
  importo: 'Import de pièces', aide: 'Centre d\'aide', help: 'Raccourcis', scan: 'Scanner un QR', news: 'Nouveautés', idee: 'Idées', classement: 'Classement amis',
  planning: 'Planning', vintage: 'Datation vintage', buyers: 'Acheteurs', lives: 'Analyse des lives', cohortes: 'Cohortes', tranches: 'Tranches de prix',
  courbe: 'Courbe de ventes', seuil: 'Seuil de rentabilité', fourn: 'Fournitures', boutique: 'Boutique (logo, couleurs)', confort: 'Confort',
};
export function libelle(name) {
  const [type, k] = String(name).split(/:(.*)/s);
  if (type === 'vue') return VUES[k] || 'Écran ' + k;
  if (type === 'outil') return OUTILS[k] || 'Outil ' + k;
  return name;
}

/* courbe sur 30 jours : points [{d:'2026-10-01', n: 3}, …] */
export function courbe(points) {
  const W = 300, H = 120, pad = 14, max = Math.max(1, ...points.map(p => p.n));
  if (!points.length) return '';
  const x = i => pad + (points.length === 1 ? 0 : i * (W - 2 * pad) / (points.length - 1));
  const y = n => H - 20 - (n / max) * (H - 40);
  const line = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.n).toFixed(1)).join(' ');
  const area = line + ` L${x(points.length - 1).toFixed(1)} ${H - 20} L${x(0).toFixed(1)} ${H - 20} Z`;
  const d0 = String(points[0].d).slice(5, 10).split('-').reverse().join('/'), d1 = String(points[points.length - 1].d).slice(5, 10).split('-').reverse().join('/');
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe sur ${points.length} jours, maximum ${max}"><path class="ar" d="${area}"/><path class="ln" d="${line}"/><text class="ax" x="${pad}" y="${H - 4}">${esc(d0)}</text><text class="ax" x="${W - pad}" y="${H - 4}" text-anchor="end">${esc(d1)}</text><text class="ax" x="${W - pad}" y="12" text-anchor="end">max ${nb(max)}</text></svg>`;
}

export function tableau(s) {
  const tot = Number(s.users_total) || 0, a1 = Number(s.active_1d) || 0, a7 = Number(s.active_7d) || 0, a30 = Number(s.active_30d) || 0;
  const fidel = a30 ? Math.round((a1 / a30) * 100) : 0;
  const top = Array.isArray(s.top_features) ? s.top_features : [];
  const mx = Math.max(1, ...top.map(f => Number(f.uses) || 0));
  const lignes = top.length
    ? top.map(f => `<div class="row"><span class="nm" title="${esc(f.name)}">${esc(libelle(f.name))}</span><span class="tr"><i style="width:${Math.max(2, Math.round((Number(f.uses) / mx) * 100))}%"></i></span><em>${nb(f.uses)} · ${nb(f.users)} pers.</em></div>`).join('')
    : '<p class="note">Aucune mesure pour l\'instant. Elles arrivent dès que des utilisateurs connectés ouvrent l\'appli (version à jour).</p>';
  return `
<div class="grid">
 <div class="kpi"><span>Inscrits</span><b>${nb(tot)}</b><small>${nb(s.users_confirmed)} e-mails confirmés</small></div>
 <div class="kpi"><span>Nouveaux sur 7 jours</span><b>${nb(s.users_7d)}</b><small>${nb(s.users_30d)} sur 30 jours</small></div>
 <div class="kpi"><span>Actifs aujourd'hui</span><b>${nb(a1)}</b><small>${tot ? Math.round((a1 / tot) * 100) : 0} % des inscrits</small></div>
 <div class="kpi"><span>Actifs sur 7 jours</span><b>${nb(a7)}</b><small>${tot ? Math.round((a7 / tot) * 100) : 0} % des inscrits</small></div>
 <div class="kpi"><span>Actifs sur 30 jours</span><b>${nb(a30)}</b><small>Fidélité jour/mois : ${fidel} %</small></div>
 <div class="kpi off"><span>Revenus mensuels (MRR)</span><b>Pas encore branché</b><small>Il faut un paiement en ligne (Stripe).</small></div>
 <div class="kpi off"><span>Désabonnements</span><b>Pas encore branché</b><small>Même condition que le MRR.</small></div>
</div>
<div class="two">
 <div class="card"><h2>Inscriptions par jour (30 j)</h2>${courbe((s.signups_by_day || []).map(p => ({ d: p.d, n: Number(p.n) || 0 })))}</div>
 <div class="card"><h2>Utilisateurs actifs par jour (30 j)</h2>${courbe((s.active_by_day || []).map(p => ({ d: p.d, n: Number(p.n) || 0 })))}</div>
</div>
<div class="card"><h2>Fonctions les plus utilisées (30 j)</h2><div class="rows">${lignes}</div></div>
<p class="note">Les mesures d'usage ne comptent que les utilisateurs connectés qui ne les ont pas refusées, et seulement depuis leur mise en place. Un « actif » est un compte qui a ouvert l'appli ce jour-là.</p>`;
}

export function entete(s) {
  const when = s && s.generated ? new Date(s.generated).toLocaleString('fr-FR') : '';
  return `<div class="bar"><div><h1>Administration de Max</h1><p class="sub">${when ? 'Chiffres du ' + esc(when) : ''}</p></div><div><button class="btn sec" id="rf" type="button">Actualiser</button> <button class="btn sec" id="so" type="button">Déconnexion</button></div></div>`;
}

function init() {
  const root = document.getElementById('admin-root');
  const CFG = window.STOCK_CONFIG || {};
  if (!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase)) { root.innerHTML = '<div class="card login"><h1>Administration</h1><p class="note">La synchronisation n\'est pas configurée (config.js).</p></div>'; return; }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  const login = (msg) => {
    root.innerHTML = `<div class="card login"><h1>Administration</h1><p class="sub">Connecte-toi avec le compte administrateur.</p>
      <label for="am">E-mail</label><input id="am" type="email" autocomplete="username"><label for="ap">Mot de passe</label><input id="ap" type="password" autocomplete="current-password">
      <button class="btn" id="ai" type="button">Se connecter</button><div class="msg" id="amsg" role="alert">${esc(msg || '')}</div></div>`;
    const go = async () => {
      const m = document.getElementById('amsg'); m.textContent = '';
      const r = await sb.auth.signInWithPassword({ email: document.getElementById('am').value.trim(), password: document.getElementById('ap').value });
      if (r.error) m.textContent = 'E-mail ou mot de passe incorrect.'; else charger();
    };
    document.getElementById('ai').onclick = go;
    document.getElementById('ap').onkeydown = e => { if (e.key === 'Enter') go(); };
  };

  async function charger() {
    root.innerHTML = '<p class="note" style="margin-top:30px">Chargement…</p>';
    const ses = await sb.auth.getSession();
    if (!ses.data || !ses.data.session) return login();
    const r = await sb.rpc('admin_stats');
    if (r.error) {
      const nope = r.error.code === '42501' || /forbidden/i.test(r.error.message || '');
      const miss = r.error.code === 'PGRST202' || r.error.code === '42883';
      if (nope) { root.innerHTML = '<div class="card login"><h1>Accès refusé</h1><p class="note">Ce compte n\'est pas administrateur.</p><button class="btn sec" id="so" type="button">Changer de compte</button></div>'; }
      else root.innerHTML = `<div class="card login"><h1>Impossible de charger</h1><p class="note">${miss ? 'Le script docs/admin-setup.sql n\'a pas encore été lancé dans Supabase.' : esc(r.error.message || 'Erreur')}</p><button class="btn sec" id="rf" type="button">Réessayer</button></div>`;
    } else root.innerHTML = entete(r.data) + tableau(r.data);
    const so = document.getElementById('so'); if (so) so.onclick = async () => { await sb.auth.signOut(); login(); };
    const rf = document.getElementById('rf'); if (rf) rf.onclick = charger;
  }
  charger();
}

if (document.getElementById('admin-root')) init();
