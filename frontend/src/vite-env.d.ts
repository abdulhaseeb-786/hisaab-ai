/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL of the backend for deployed builds. Empty in development (Vite proxies). */
  readonly VITE_API_BASE_URL?: string;
  /** Key for the demo reset button. Matches the backend's DEMO_RESET_KEY. */
  readonly VITE_DEMO_RESET_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
