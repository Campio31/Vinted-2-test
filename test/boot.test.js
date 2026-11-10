import { describe, it, expect } from 'vitest';
import { app } from '../src/state.js';
import { demarrer } from './helpers.js';

describe('démarrage', () => {
  it("charge tous les modules, affiche l'onglet Ajouter et accepte un jeu de pièces", async () => {
    await demarrer(200);
    expect(app.loaded).toBe(true);
    expect(document.getElementById('ttl').textContent).toBe('Ajouter');
    expect(app.P.length).toBe(200);
  });
});