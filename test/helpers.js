import { app } from '../src/state.js';

/* Données d'essai : 200 pièces, vendues ou non, avec acheteurs, lots et ballots. */
export function jeu(n = 200) {
  let sd = 7; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const iso = d => d.toISOString().slice(0, 10), now = Date.now();
  const marques = ['Lacoste', 'Nike', "Levi's", 'Adidas', 'Zara'], types = [['Haut', 'Polo'], ['Haut', 'Sweat'], ['Bas', 'Jean'], ['Veste', 'Veste']], pseudos = ['lea_m', 'tomtom31', 'paul'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const [cat, sub] = types[Math.floor(R() * types.length)], ent = iso(new Date(now - Math.floor(R() * 150) * 864e5)), achat = Math.round((1 + R() * 10) * 2) / 2;
    const p = { id: 't' + i, cat, sub, marque: marques[Math.floor(R() * marques.length)], taille: ['S', 'M', 'L'][Math.floor(R() * 3)], genre: 'Homme', grade: 'A', etat: 'Bon état', achat, entree: ent, statut: 'Disponible', ballot: i % 2 ? 'Ballot A' : 'Ballot B' };
    if (R() < 0.5) p.pub = ent;
    if (R() < 0.5) { const dv = iso(new Date(Date.parse(ent) + (1 + Math.floor(R() * 30)) * 864e5)); if (dv <= iso(new Date(now))) Object.assign(p, { statut: 'Vendu', dv, pv: Math.round(achat * 2.5 * 2) / 2, canal: R() < 0.4 ? 'TikTok Live' : 'Vinted', frais: 0.9, vt: Date.parse(dv + 'T19:30:00'), acheteur: pseudos[Math.floor(R() * 3)] }); }
    out.push(p);
  }
  return out;
}

/* Démarre l'appli une seule fois par fichier de test et y charge des pièces. */
export async function demarrer(n = 200) {
  await import('../src/main.js');
  await new Promise(r => setTimeout(r, 300));
  const { importText } = await import('../src/modules/export-import.js');
  await importText(JSON.stringify({ pieces: jeu(n) }));
  return app;
}