import { esc } from './core.js';

/* ---------- illustrations de la datation vintage ---------- */
/* Dessins schématiques (pas des photos ni des logos de marque) pour repérer où regarder sur une pièce,
   et une règle des décennies pour situer chaque indice. Les couleurs viennent des variables du thème. */

const n = (x, y, k) => `<g class="il-n"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${k}</text></g>`;
const svg = (label, body, h = 120) => `<svg viewBox="0 0 300 ${h}" class="ill" role="img" aria-label="${esc(label)}">${body}</svg>`;

const ART = {
  /* étiquette de col : marque, taille, pays, n° RN, pictogrammes d'entretien */
  label: () => ({
    svg: svg(t('Schéma d\'une étiquette'), `
      <rect class="il-bg" x="40" y="8" width="220" height="104" rx="8"/>
      <rect class="il-band" x="52" y="18" width="130" height="22" rx="3"/><text class="il-t il-on" x="117" y="34" text-anchor="middle">BRAND</text>
      <text class="il-t" x="52" y="60">M · 38 · 40</text>
      <text class="il-t" x="52" y="80">MADE IN USA</text>
      <text class="il-t il-mu" x="52" y="100">RN 12345</text>
      <g class="il-ic"><path d="M200 24h30l-4 18h-22z"/><path d="M206 62l14-18 14 18z"/><rect x="204" y="72" width="26" height="22" rx="2"/><circle cx="217" cy="83" r="6"/></g>
      ${n(30, 29, 1)}${n(30, 76, 2)}${n(30, 98, 3)}${n(246, 29, 4)}`),
    cap: [t('Marque et police : compare avec des photos datées'), t('Pays de fabrication : un pays qui n\'existe plus date la pièce'), t('Numéro RN (USA) : il désigne le fabricant, tu peux le chercher dans la base officielle'), t('Pictogrammes de lavage : courants à partir de la fin des années 70')]
  }),
  /* pays de fabrication */
  madein: () => ({
    svg: svg(t('Pays de fabrication selon les époques'), `
      <rect class="il-bg" x="6" y="22" width="88" height="56" rx="6"/><text class="il-t" x="50" y="46" text-anchor="middle">WEST</text><text class="il-t" x="50" y="64" text-anchor="middle">GERMANY</text>
      <rect class="il-bg" x="106" y="22" width="88" height="56" rx="6"/><text class="il-t" x="150" y="46" text-anchor="middle">USA · UK</text><text class="il-t" x="150" y="64" text-anchor="middle">ITALY</text>
      <rect class="il-bg" x="206" y="22" width="88" height="56" rx="6"/><text class="il-t" x="250" y="46" text-anchor="middle">CHINA</text><text class="il-t" x="250" y="64" text-anchor="middle">VIETNAM</text>
      <path class="il-ar" d="M12 100h276M282 95l6 5-6 5"/>
      ${n(50, 12, 1)}${n(150, 12, 2)}${n(250, 12, 3)}`, 116),
    cap: [t('Un pays disparu (Allemagne de l\'Ouest, Yougoslavie, URSS) : avant 1990-1992'), t('USA, Royaume-Uni, Italie, France, Japon : fréquent avant 2000'), t('Chine, Vietnam, Bangladesh : surtout après 2000')]
  }),
  /* ourlet : une ou deux lignes de couture */
  stitch: () => ({
    svg: svg(t('Ourlet à une ou deux coutures'), `
      <rect class="il-bg" x="10" y="14" width="280" height="38" rx="4"/><path class="il-st" d="M18 33h264"/>
      <rect class="il-bg" x="10" y="68" width="280" height="38" rx="4"/><path class="il-st" d="M18 80h264M18 94h264"/>
      ${n(24, 6, 1)}${n(24, 60, 2)}`, 116),
    cap: [t('Une seule ligne de couture (point simple) : plutôt avant 1995'), t('Deux lignes (double aiguille) : plutôt après 1995')]
  }),
  /* fermeture éclair */
  zip: () => ({
    svg: svg(t('Fermeture éclair'), `
      <rect class="il-bg" x="20" y="10" width="64" height="100" rx="6"/>
      <g class="il-ic">${Array.from({ length: 8 }, (_, i) => `<path d="M46 ${20 + i * 11}h8M50 ${25 + i * 11}h8"/>`).join('')}</g>
      <rect class="il-band" x="42" y="34" width="22" height="20" rx="4"/><path class="il-ic" d="M53 54v22"/>
      <text class="il-t" x="104" y="44">TALON · SCOVILL</text><text class="il-t il-mu" x="104" y="62">CONMAR · CROWN</text>
      <text class="il-t" x="104" y="92">YKK</text>
      ${n(96, 36, 1)}${n(96, 84, 2)}`),
    cap: [t('Fabricants anciens (Talon, Scovill, Conmar, Crown) : plutôt avant les années 80'), t('YKK : le dessin du logo gravé sur le curseur change selon les époques, compare avec des photos datées')]
  }),
  /* Levi's : Big E / petit e */
  bige: () => ({
    svg: svg(t('Languette rouge : grand E ou petit e'), `
      <rect class="il-red" x="30" y="24" width="100" height="40" rx="3"/><text class="il-t il-on" x="80" y="50" text-anchor="middle" font-size="18">LEVI'S</text>
      <rect class="il-red" x="170" y="24" width="100" height="40" rx="3"/><text class="il-t il-on" x="220" y="50" text-anchor="middle" font-size="18">levi's</text>
      <text class="il-t" x="80" y="92" text-anchor="middle">Big E</text><text class="il-t" x="220" y="92" text-anchor="middle">small e</text>
      ${n(30, 14, 1)}${n(170, 14, 2)}`, 104),
    cap: [t('Grand E majuscule (Big E) : avant 1971'), t('Petit e : après 1971')]
  }),
  /* bouton en métal gravé */
  button: () => ({
    svg: svg(t('Bouton en métal gravé'), `
      <circle class="il-bg" cx="150" cy="56" r="46"/><circle class="il-ring" cx="150" cy="56" r="36"/>
      <text class="il-t" x="150" y="52" text-anchor="middle">★ BRAND ★</text><text class="il-t il-mu" x="150" y="70" text-anchor="middle">No. 501</text>
      ${n(214, 22, 1)}`),
    cap: [t('Bouton en métal gravé, lourd, avec le nom ou un numéro : plutôt ancien')]
  })
};

/** Quelle illustration pour quelle rubrique ? (selon le titre) */
export function illusFor(brand, title) {
  const s = String(title || '').toLowerCase();
  if (/levi/i.test(brand || '') && /rouge|tab/.test(s)) return 'bige';
  if (/pays|made in|fabrication/.test(s)) return 'madein';
  if (/entretien|^étiquette/.test(s)) return 'label';
  if (/coutures/.test(s)) return 'stitch';
  if (/fermetures/.test(s)) return 'zip';
  if (/boutons/.test(s)) return 'button';
  return '';
}

export function illusHTML(key) {
  const a = ART[key]; if (!a) return '';
  const d = a();
  return `<figure class="illf">${d.svg}<ol class="illc">${d.cap.map(c => `<li>${esc(c)}</li>`).join('')}</ol></figure>`;
}

/* ---------- règle des décennies ---------- */
const DEC = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
const yr = s => { const v = +s; return v >= 1000 ? v : v < 30 ? 2000 + v : 1900 + v; };

/** Période évoquée par une phrase d'indice : [début, fin] en années, ou null. */
export function eraOf(txt) {
  const s = String(txt || '').toLowerCase();
  let m;
  if ((m = s.match(/avant (?:l'an |les années )?(\d{4})/))) return [1950, +m[1] - 1];
  if ((m = s.match(/années (2000|\d{2})\b\s*(?:à|-|–)\s*(?:années )?(2000|\d{2})\b/))) return [yr(m[1]), yr(m[2]) + 9];
  if ((m = s.match(/années (2000|\d{2})\b et (?:après|suivantes|plus)/)) || (m = s.match(/à partir (?:de la fin )?(?:de |des )?(?:années )?(\d{4}|\d{2})\b/)) || (m = s.match(/après (?:les années )?(\d{4})/))) return [yr(m[1]), 2029];
  if ((m = s.match(/années (2000|\d{2})\b/))) return [yr(m[1]), yr(m[1]) + 9];
  return null;
}

/** Petite règle 1960 → 2020 avec les décennies concernées en couleur. */
export function eraBar(txt) {
  const e = eraOf(txt); if (!e) return '';
  const cells = DEC.map(d => { const on = d + 9 >= e[0] && d <= e[1]; return `<i class="${on ? 'on' : ''}">${String(d).slice(2)}</i>`; }).join('');
  const lab = e[1] >= 2029 ? t('depuis {a}', { a: e[0] }) : e[0] <= 1950 ? t('jusqu\'en {b}', { b: e[1] }) : e[0] + ' – ' + e[1];
  return `<em class="era" role="img" aria-label="${esc(t('Période'))} : ${esc(lab)}">${cells}</em>`;
}
