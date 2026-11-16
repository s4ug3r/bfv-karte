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
  build: {
    rollupOptions: {
      output: {
        // Bibliotheken in eigene Dateien: Nach einem App-Update lädt der Browser nur den
        // geänderten App-Teil neu, die großen Bibliotheken bleiben im Zwischenspeicher.
        manualChunks: {
          react: ['react', 'react-dom'],
          query: ['@tanstack/react-query', '@tanstack/react-query-persist-client', '@tanstack/query-sync-storage-persister'],
          bfv: ['bfv-api', 'axios'],
          maps: ['@googlemaps/js-api-loader', '@googlemaps/markerclusterer'],
        },
      },
    },
  },
  // host + allowedHosts: Zugriff vom Handy (WLAN) bzw. über Tailscale/Cloudflare-Tunnel erlauben
  server: { proxy: bfvProxy, host: true, allowedHosts: ['.ts.net', '.trycloudflare.com'] },
  preview: { proxy: bfvProxy, host: true, allowedHosts: ['.ts.net', '.trycloudflare.com'] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
