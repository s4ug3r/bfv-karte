/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
  readonly VITE_BFV_DATA_PROVIDER?: 'bfv' | 'mock' | 'rest' | 'static' | '';
  readonly VITE_BFV_PROXY_URL?: string;
  readonly VITE_BFV_WEB_PROXY_URL?: string;
  readonly VITE_BFV_SEED?: string;
  readonly VITE_BFV_MATCH_URL_TEMPLATE?: string;
  readonly VITE_BFV_API_BASE_URL?: string;
  readonly VITE_BFV_API_AREA_QUERY?: string;
  readonly VITE_BFV_STATIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
