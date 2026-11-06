import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { config } from './config';
import './index.css';
import { getSafeStorage } from './utils/storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: config.cache.matchesStaleMs,
      gcTime: config.cache.matchesMaxAgeMs,
      refetchOnWindowFocus: true,
    },
  },
});

// Ergebnisse im localStorage zwischenspeichern: wiederholte Suchen und Neuladen sind sofort da.
// Nach 6 h (maxAge) oder bei neuer Cache-Version (buster) wird der Speicher verworfen.
const storage = getSafeStorage();
const persister = storage
  ? createSyncStoragePersister({ storage, key: `bfv.queryCache.${config.cacheVersion}`, throttleTime: 1000 })
  : undefined;

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    {persister ? (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: config.cache.matchesMaxAgeMs, buster: config.cacheVersion }}
      >
        <App />
      </PersistQueryClientProvider>
    ) : (
      // Ohne localStorage (z. B. privater Modus mit Sperre) nur In-Memory-Cache
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )}
  </StrictMode>,
);

