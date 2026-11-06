import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Proxy für die BFV-Widget-Schnittstelle: Der Browser ruft "/bfv-api/..." auf der eigenen
 * Domain auf, Vite leitet an widget-prod.bfv.de weiter. So gibt es keine CORS-Probleme.
 * Für das Hosting übernehmen public/_redirects (Netlify) bzw. vercel.json dieselbe Aufgabe.
 */
const bfvProxy = {
  '/bfv-api': {
    target: 'https://widget-prod.bfv.de',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/bfv-api/, '/api/service/widget/v1'),
  },
  // Vereinsseiten von bfv.de (Liste aller Mannschaften eines Vereins) für die Umgebungserkundung
  '/bfv-web': {
    target: 'https://www.bfv.de',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/bfv-web/, ''),
  },
};

// https://vite.dev/config/ – vitest/config erweitert die Vite-Konfiguration um "test".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: bfvProxy },
  preview: { proxy: bfvProxy },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
