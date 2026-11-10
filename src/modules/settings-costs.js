import { app } from '../state.js';
import { $, esc, num } from './core.js';
import { GKEY, goalKinds } from './goals.js';
import { DEFAULTS } from './platforms.js';
import { TI } from './tools-index.js';

/* ---------- objectifs et coûts (écran Réglages) ---------- */
/* Quatre blocs : objectifs, frais par colis, plateformes, seuils du feu vert. Les identifiants des champs (c_goal, c_emb…) sont ceux des tests et du gestionnaire plus bas. */
const IC = {
  goal: TI('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>'),
  box: TI('<path d="M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8M12 13v8"/>'),
  shop: TI('<path d="M4 9l1.500-5h13L20 9M4 9v11h16V9M4 9a2.700 2.700 0 0 0 5.300 0 2.700 2.700 0 0 0 5.400 0A2.700 2.700 0 0 0 20 9M10 20v-6h4v6"/>'),
  ok: TI('<path d="M5 12l4.500 4.500L19 7"/>'),
};
const eurS = v => String(Math.round(v * 100) / 100).replace('.', app.DS);
export function renderCfg() {
  const c = $('cfgc'); if (!c || c.contains(document.activeElement)) return;
  const f = (id, l, v, u) => `<div class="cfld"><label class="l" for="${id}">${t(l)}</label><span class="uin"><input type="text" inputmode="decimal" id="${id}" value="${esc(String(v).replace('.', app.DS))}"${u === '€' ? ' placeholder="0"' : ''}><i aria-hidden="true">${u}</i></span></div>`;
  const grp = (ic, h, s, body) => `<section class="cg"><header><span class="cgi">${IC[ic]}</span><div><b>${t(h)}</b><small>${t(s)}</small></div></header>${body}</section>`;
  const modes = [['net', 'Bénéfice net'], ['ca', 'Chiffre d\'affaires'], ['both', 'Les deux']];
  const kinds = goalKinds();
  const pf = i => String(app.cfg['pf' + i] || '').trim() || t('Plateforme {n}', { n: i });
  const ex = 20, prev = i => app.defFrais(ex, i === 1 ? 'Vinted' : 'TikTok Live');
  c.innerHTML = `<h3>${t('Objectifs et coûts')}</h3><p class="sub">${t('Servent à l\'objectif mensuel, au calcul de marge et aux frais préremplis. Synchronisés entre tes appareils.')}</p>`
    + grp('goal', 'Objectifs', 'Ce que tu veux gagner, pour savoir si tu es en avance',
      `<div class="seg" role="group" aria-label="${esc(t('Objectif à suivre'))}">${modes.map(([k, l]) => `<button type="button" class="${app.cfg.goalMode === k ? 'on' : ''}" data-gm="${k}">${t(l)}</button>`).join('')}</div>`
      + kinds.map(k => `<div class="grow"><b>${t(k === 'net' ? 'Bénéfice net' : 'Chiffre d\'affaires')}</b><div class="row2">${f(k === 'net' ? 'c_goal' : 'c_goalCA', 'Par mois', app.cfg[GKEY[k].m] || '', '€')}${f(k === 'net' ? 'c_goalY' : 'c_goalYCA', 'Par an', app.cfg[GKEY[k].y] || '', '€')}</div></div>`).join('')
      + `<div class="hint">${t('Laisse un champ vide pour ne pas fixer d\'objectif.')}</div>`)
    + grp('box', 'Frais par colis', 'Ajoutés aux frais de chaque vente',
      `<div class="row2">${f('c_emb', 'Emballage par colis (€)', app.cfg.emb, '€')}${f('c_port', 'Envoi à ta charge (€)', app.cfg.port, '€')}</div>`)
    + grp('shop', 'Plateformes de vente', 'Le nom que tu veux, et la commission que chacune te prélève (0 si aucune)',
      [1, 2].map(i => `<div class="pfr"><div class="cfld"><label class="l" for="c_pf${i}">${t('Plateforme {n}', { n: i })}</label><input type="text" id="c_pf${i}" value="${esc(app.cfg['pf' + i] || '')}" placeholder="${esc(DEFAULTS[i])}" maxlength="24" autocomplete="off"></div>${f(i === 1 ? 'c_comV' : 'c_comT', 'Commission (%)', i === 1 ? app.cfg.comV : app.cfg.comT, '%')}</div>`).join('')
      + `<div class="cprev">${[1, 2].map(i => `<span>${t('Une vente à {p} € sur {n} : {f} € de frais', { p: ex, n: esc(pf(i)), f: eurS(prev(i)) })}</span>`).join('')}</div>`)
    + grp('ok', 'Feu vert des pièces', 'À partir de quand une pièce est jugée rentable',
      `<div class="row2">${f('c_roi', 'ROI minimum pour le vert (%)', app.cfg.roi, '%')}${f('c_minM', 'Marge minimum pour le vert (€)', app.cfg.minM, '€')}</div>`);
}
$('cfgc').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (!b) return; app.setCfg({ goalMode: b.dataset.gm }); document.activeElement.blur(); renderCfg(); app.renderAll(); });
$('cfgc').addEventListener('change', e => {
  if (e.target.id === 'c_pf1' || e.target.id === 'c_pf2') { app.setCfg({ [e.target.id.slice(2)]: e.target.value.trim().slice(0, 24) }); app.toast(t('Réglage enregistré')); app.renderAll(); return; }
  const map = { c_goal: 'goal', c_goalCA: 'goalCA', c_goalY: 'goalY', c_goalYCA: 'goalYCA', c_emb: 'emb', c_port: 'port', c_comV: 'comV', c_comT: 'comT', c_roi: 'roi', c_minM: 'minM' }, k = map[e.target.id];
  if (!k) return;
  const v = num(e.target.value);
  app.setCfg({ [k]: isNaN(v) || v < 0 ? 0 : v });
  app.toast(t('Réglage enregistré'));
  app.renderAll();
});
