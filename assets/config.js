// Carfixo – Supabase-Verbindung (öffentlicher Publishable Key, kein Geheimnis)
window.CARFIXO = {
  SUPABASE_URL: "https://boozzfiroukraekyijfq.supabase.co",
  SUPABASE_KEY: "sb_publishable_M5t-rf_Se7D4-Rrwjawj1w_cPjl3X2Q",
  // Öffentlicher VAPID-Schlüssel für Web-Push. Gehört bewusst ins Frontend –
  // der Browser braucht ihn zum Anlegen des Abos. Der private Teil liegt
  // ausschließlich serverseitig in private.app_secrets.
  VAPID_PUBLIC_KEY: "BOBypMjaqR4mq35n5s-iXbkNsb7ANB0_CR_S1WX1V32gu0TvZ-EkZffRo9gyX9cXZOA0mFzwTAk9nYg6LA0lVf8",
};
