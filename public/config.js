/* Configuration de la synchronisation. Remplis ces deux valeurs en suivant SYNCHRONISATION.md.
   La clé « anon » (ou « publishable ») est faite pour être publique : tes données sont protégées par ton compte et par les règles du fichier supabase-setup.sql.
   N'écris JAMAIS ici la clé « service_role ». */
window.STOCK_CONFIG = {
  supabaseUrl: 'https://akbwyxbllrfeibmtwdbh.supabase.co',
  supabaseKey: 'sb_publishable_3WGlhOZqehwV0Kds1ao1yQ_MhzmnoJE',   // clé publishable (publique)
  vapidPublicKey: 'BHeliuiV1EPO5RL-vr5nYUdDumr-RFk7iaoBk5C282V5n0NvyzKjDDzKzC4nFz1bMHeoNWEvGtt51h5yfN-RSS8'   // clé PUBLIQUE des notifications push (générée avec generer-cles-vapid.html, voir PUSH-ET-CLASSEMENT.md). Jamais la clé privée.
  ,
  sentryDsn: 'https://cad6b7aa43eac1f9ad58f246d595d224@o4512341501345792.ingest.de.sentry.io/4512341528477776',   // suivi des erreurs : colle ici le DSN de ton projet Sentry (voir docs/SENTRY.md). Vide = rien n'est envoyé.
  feedbackEmail: ''   // adresse de contact affichée dans Réglages, À propos (elle est PUBLIQUE). Vide = un bouton « Écrire ou proposer une idée » à la place.
};
